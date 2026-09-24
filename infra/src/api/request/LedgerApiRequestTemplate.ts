// Idempotency-Key travels as a native SQS message attribute, never spliced into the body: API Gateway's VTL engine cannot escape double quotes inside `$util.urlEncode("...")`, so body-splicing fails with a parse error. MessageBody stays an exact passthrough of the request body.
// CustomerId travels the same way, from the `Customer-Id` header — the one seam for identity: with a real authoriser, `$context.authorizer.principalId` replaces `$input.params('Customer-Id')` here and nothing else changes (docs/decisions/0003-kyc-gating.md).
// Every `#set` line (and only `#set` lines) may be blank-adjacent — Velocity swallows a directive-only line's newline but not a truly blank one, so the rendered body stays byte-identical to one line.
export const LEDGER_API_REQUEST_TEMPLATE = `#set($assetId = $input.path('$.assetId'))
#set($idempotencyKey = $input.params('Idempotency-Key'))
#set($customerId = $input.params('Customer-Id'))
#set($action = "Action=SendMessage")
#set($messageGroupId = "&MessageGroupId=$util.urlEncode($assetId)")
#set($messageBody = "&MessageBody=$util.urlEncode($input.body)")
#set($attributeName = "&MessageAttribute.1.Name=IdempotencyKey")
#set($attributeType = "&MessageAttribute.1.Value.DataType=String")
#set($attributeValue = "&MessageAttribute.1.Value.StringValue=$util.urlEncode($idempotencyKey)")
#set($customerAttributeName = "&MessageAttribute.2.Name=CustomerId")
#set($customerAttributeType = "&MessageAttribute.2.Value.DataType=String")
#set($customerAttributeValue = "&MessageAttribute.2.Value.StringValue=$util.urlEncode($customerId)")
#set($body = "$action$messageGroupId$messageBody$attributeName$attributeType$attributeValue$customerAttributeName$customerAttributeType$customerAttributeValue")
$body`;
