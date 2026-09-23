# Architecture

> DRAFT — diagram only (Phase 8, step 1). Prose per box and the two ADRs come in step 2, after this diagram is reviewed.

```mermaid
flowchart TB
    client([Client])

    subgraph aws[" "]
        apigw["API Gateway<br/>JSON Schema validator<br/>requires Idempotency-Key header"]
        queue[["SQS FIFO queue<br/>MessageGroupId = assetId<br/>content-based dedup"]]
        dlq[["SQS FIFO DLQ"]]
        worker["Worker Lambda<br/>batch of 5, partial batch failures"]
        table[("DynamoDB<br/>idempotency table")]
        bus{{"EventBridge<br/>custom bus"}}
        downstream["Downstream consumers<br/>(stubbed, not built)"]
    end

    client -- "POST /fractionalization-requests" --> apigw
    apigw -- "400 invalid request" --> client
    apigw -- "SendMessage (direct integration, no Lambda)<br/>Idempotency-Key as message attribute" --> queue
    apigw -- "202 Accepted<br/>(sent once queued, before the worker runs)" --> client
    queue -- "after 3 failed receives" --> dlq
    queue -- "event source mapping" --> worker
    worker -- "PutItem<br/>attribute_not_exists(idempotencyKey)" --> table
    worker -- "PutEvents KYC_PASSED_STUB<br/>on first write and on duplicate" --> bus
    bus -.-> downstream

    table -. "evolution path, not built:<br/>DynamoDB Streams to EventBridge Pipes<br/>(outbox pattern)" .-> bus

    subgraph test["Acceptance-test stack only (includeEventSink context flag)"]
        sink["Rule to Step Functions PutItem"]
        sinktable[("Sink table<br/>idempotencyKey + eventId")]
    end

    bus -. "KYC_PASSED_STUB rule<br/>(test only)" .-> sink
    sink -.-> sinktable

    downstream ~~~ sink

    linkStyle 10,11 stroke:#d98e04,stroke-width:2px
```

The outer box is the CDK `LedgerStack` (its title is left blank so the client edges don't cross it). Solid lines are built. Dotted grey lines are not built (downstream consumers, the outbox path). Dotted orange lines exist only in the acceptance-test stack (the sink).
