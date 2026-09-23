# Event-Driven Ledger

An example event-driven architecture on AWS, built the way it would be built for real: test-first, with the infrastructure's output under regression test and the module boundaries enforced by the linter.

It is a deliberately small "walking skeleton" of a tokenized-asset ledger. A client submits a fractionalization request; the system accepts it, records it **exactly once**, and announces it as a `KYC_PASSED_STUB` event. There is no Web3 logic and no third-party KYC — just the plumbing.

```
Client → API Gateway → SQS FIFO → Worker Lambda → DynamoDB (conditional write) → EventBridge
```

See [`docs/architecture.md`](docs/architecture.md) for the diagram and a paragraph per box.

## What it demonstrates

- **No Lambda in the hot path.** API Gateway validates the request against a JSON Schema and writes straight to a FIFO queue, answering `202 Accepted`.
- **Idempotency you can prove.** The worker records each `Idempotency-Key` with a DynamoDB `PutItem` guarded by `attribute_not_exists`, so a replayed request cannot double-spend.
- **Honest about the gaps.** Two well-known traps are named, decided and documented as ADRs rather than hand-waved:
  - [SQS content-based deduplication is not the idempotency guard](docs/decisions/0001-dedup-vs-idempotency.md)
  - [The dual write (DynamoDB, then EventBridge) and why the event is emitted on a duplicate too](docs/decisions/0002-dual-write.md)
- **Decoupled downstream.** Success is announced on a custom EventBridge bus; consumers are not built, and the outbox evolution path is documented.

## Practices worth stealing

- **Acceptance-test-first (ATDD).** Given/when/then specs read as business language, run against a real deployed stack, and talk only to a small DSL. The DSL sits over AWS clients, and lint rules stop a spec from touching the SDK or the network directly.
- **Unit-test-first** for the pure logic in `domain`, with the habit of watching every test fail for the right reason before trusting it.
- **Infrastructure is tested too.** The synthesized CloudFormation of the whole stack is snapshot-tested (Lambda asset hashes normalized out, so a diff always means something), plus a few named assertions for properties that must never regress. A contract test keeps the acceptance stack and the acceptance tests from drifting apart.
- **Boundaries enforced by lint, not convention.** Deny-by-default `no-restricted-imports` per package; `domain` cannot import an AWS SDK; `infra` deploys the worker's built artifact and never imports its source.
- **One export per file**, PascalCase, folders named for subject, top-down reading order.
- **A hard CI gate** (`pnpm checks`: lint, format, type-check, unit and CDK snapshot tests) ahead of a slower acceptance job against LocalStack.
- **Supply-chain care.** A pnpm workspace catalog with exact pins and a comment on every entry, plus a minimum release age on new versions.
- **AI-assisted, human-reviewed.** [`AGENTS.md`](AGENTS.md) (root and per package) tells any coding agent how to work here; the developer commits everything.

## Layout

| Package | Purpose |
|---|---|
| [`shared`](shared) | Event schemas, the request JSON Schema, stack output names, shared tool config. Depends on nothing. |
| [`domain`](domain) | Pure business logic — idempotency-key semantics, event payload construction. No AWS imports. |
| [`worker`](worker) | The SQS-batch Lambda. Wires `domain` to the AWS SDK; handles FIFO partial batch failures. |
| [`infra`](infra) | The CDK app: queue, table, bus, API, worker, and a test-only event sink behind a context flag. |
| [`acceptance-tests`](acceptance-tests) | The ATDD DSL and the specs, run against a deployed stack. |

## Running it

Requires Node 24, pnpm and Docker.

```sh
pnpm install
pnpm checks            # lint, format, type-check, unit + CDK snapshot tests — no AWS needed
```

To run the acceptance specs against [LocalStack](https://www.localstack.cloud/) (its free Hobby tier needs an account and a `LOCALSTACK_AUTH_TOKEN`, is non-commercial, and has no official CI support):

```sh
docker run -d --name ledger-localstack -p 127.0.0.1:4566:4566 -e LOCALSTACK_AUTH_TOKEN \
  -v /var/run/docker.sock:/var/run/docker.sock localstack/localstack:latest

AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 \
  pnpm --dir infra exec cdklocal bootstrap                 # once per container
pnpm --dir infra deploy:local                              # destroy, then a fresh deploy
pnpm --dir acceptance-tests acceptance-tests
```

Always destroy before redeploying locally — `deploy:local` does. On LocalStack, an incremental update to a stack containing API Gateway silently breaks the Stage and every request returns 404.

The same specs can target real AWS: deploy with `pnpm --dir infra deploy:aws` and run them with `ACCEPTANCE_TARGET=aws`.

## Where to read next

- [`docs/architecture.md`](docs/architecture.md) — the diagram, each box, and how it is tested
- [`docs/decisions/`](docs/decisions) — the two ADRs
- [`AGENTS.md`](AGENTS.md) — the working conventions, and one per package for the local rules
