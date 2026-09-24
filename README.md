# Event-Driven Ledger

An example event-driven architecture on AWS, built the way it would be built for real: test-first, with the infrastructure's output under regression test and the module boundaries enforced by the linter.

It is a deliberately small "walking skeleton" of a tokenised-asset ledger. A client submits a fractionalisation request; the system accepts it, checks the customer's KYC status, records the decision **exactly once**, and announces it as a `KYC_PASSED` or `KYC_REJECTED` event. There is no Web3 logic and no real KYC provider — just the plumbing.

```
Client → API Gateway → SQS FIFO → Worker Lambda → DynamoDB (KYC lookup, conditional write) → EventBridge
```

See [`docs/architecture.md`](docs/architecture.md) for the diagram and a paragraph per box.

## What is fractionalisation?

Fractionalisation means dividing ownership of a single asset (a painting, a building, a bond) into many small shares, so that several people can each hold a piece. It is the same idea as a fractional share of a stock. Recording who owns which fraction is a ledger problem, and a ledger is only trustworthy if each change is written down exactly once.

A **fractionalisation request** is a client's ask to have an asset fractionalised. It carries:

- `assetId`: the asset to fractionalise. It is also the FIFO `MessageGroupId`, so requests for one asset are processed in order while different assets run in parallel.
- `requestId`: the client's identifier for this request.
- an `Idempotency-Key` header: the client's retry token. Sending the same key again, for example after a timeout, must not create a second record.
- a `Customer-Id` header: who the request is from. It stands in for the identity a real authoriser would supply, and a `customerId` in the body is never believed.

This project handles the **intake** side only. It accepts the request, checks the customer's KYC status, records the decision once, and announces the outcome with a `KYC_PASSED` or `KYC_REJECTED` event. It does not decide share counts or prices, and it does not issue tokens. Those belong to consumers of the event, which are not built. The exactly-once record is what makes replays safe: a repeated key is recognised and never recorded twice ([ADR 0001](docs/decisions/0001-dedup-vs-idempotency.md)).

### What is KYC?

**KYC** stands for **Know Your Customer**: the identity check that banks, brokers and asset platforms are legally required to complete before a person can transact. It usually means verifying who someone is (an ID document, proof of address, sometimes a selfie check) and screening them against sanctions and fraud lists, as part of anti-money-laundering rules. On a real fractionalisation platform, KYC would have to pass before a client could buy or hold fractions of an asset.

Here the check is real but the provider is not. The worker looks the customer up in the ledger's own KYC status table. A customer who is `verified` and not past their expiry gets `KYC_PASSED`; anyone else gets `KYC_REJECTED` with a reason (`pending`, `expired` or `not-verified`). The decision is stored with the idempotency key, so a repeat of a request replays the original decision even if the customer's KYC has changed since. No KYC provider is called: the acceptance tests seed the status table, standing in for the feed a real provider would send ([ADR 0003](docs/decisions/0003-kyc-gating.md)).

## What it demonstrates

- **No Lambda in the hot path.** API Gateway validates the request against a JSON Schema and writes straight to a FIFO queue, answering `202 Accepted`.
- **Idempotency you can prove.** The worker records each customer's `Idempotency-Key` with a DynamoDB `PutItem` guarded by `attribute_not_exists`, so a replayed request cannot double-spend, and one customer's key never collides with another's ([ADR 0004](docs/decisions/0004-customer-scoped-idempotency.md)).
- **Identity from the transport, never the body.** Every request must say who it is from, and the worker reads that from a message attribute set at the API, so a client cannot claim to be someone else.
- **A decision that is recorded and replayed.** The KYC decision is stored with the idempotency key, so a repeat replays what was first decided and an audit can see what was known at the time.
- **Honest about the gaps.** Well-known traps and shortcuts are named, decided and documented as ADRs rather than hand-waved:
  - [SQS content-based deduplication is not the idempotency guard](docs/decisions/0001-dedup-vs-idempotency.md)
  - [The dual write (DynamoDB, then EventBridge) and why the event is emitted on a duplicate too](docs/decisions/0002-dual-write.md)
  - [Gating every request on the customer's KYC status, and recording the decision](docs/decisions/0003-kyc-gating.md)
- **Decoupled downstream.** The outcome is announced on a custom EventBridge bus; consumers are not built, and the outbox evolution path is documented.

## Practices worth stealing

- **Acceptance-test-first (ATDD).** Given/when/then specs read as business language, run against a real deployed stack, and talk only to a small DSL. The DSL sits over AWS clients, and lint rules stop a spec from touching the SDK or the network directly.
- **Unit-test-first** for the pure logic in `domain`, with the habit of watching every test fail for the right reason before trusting it, and of breaking the code on purpose to prove a test that was written after it.
- **Infrastructure is tested too.** The synthesised CloudFormation of the whole stack is snapshot-tested (Lambda asset hashes normalised out, so a diff always means something), plus a few named assertions for properties that must never regress. A contract test keeps the acceptance stack and the acceptance tests from drifting apart.
- **Boundaries enforced by lint, not convention.** Deny-by-default `no-restricted-imports` per package; `domain` cannot import an AWS SDK; `infra` deploys the worker's built artifact and never imports its source.
- **One concept per file**, PascalCase, folders named for subject, top-down reading order.
- **A hard CI gate** (`pnpm checks`: lint, format, type-check, unit and CDK snapshot tests) ahead of a slower acceptance job against LocalStack.
- **Supply-chain care.** A pnpm workspace catalog with exact pins and a comment on every entry, plus a minimum release age on new versions.
- **AI-assisted, human-reviewed.** [`AGENTS.md`](AGENTS.md) (root and per package) tells any coding agent how to work here; the developer commits everything.

## Layout

| Package | Purpose |
|---|---|
| [`shared`](shared) | Event schemas, the request JSON Schema, stack output names, the KYC vocabulary (statuses, reasons, outcomes), shared tool config. Depends on nothing. |
| [`domain`](domain) | Pure business logic — reading the idempotency key and customer, the KYC decision rule, event payload construction. No AWS imports. |
| [`worker`](worker) | The SQS-batch Lambda. Looks up the KYC status, records and announces the decision, wiring `domain` to the AWS SDK; handles FIFO partial batch failures. |
| [`infra`](infra) | The CDK app: queue, idempotency and KYC tables, bus, API, worker, and a test-only event sink behind a context flag. |
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
- [`docs/decisions/`](docs/decisions) — the three ADRs
- [`AGENTS.md`](AGENTS.md) — the working conventions, and one per package for the local rules
