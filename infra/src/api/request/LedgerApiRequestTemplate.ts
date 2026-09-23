// Idempotency-Key travels as a native SQS message attribute, never spliced into the body: API Gateway's VTL engine cannot escape double quotes inside `$util.urlEncode("...")`, so body-splicing fails with a parse error. MessageBody stays an exact passthrough of the request body.
// Every `#set` line (and only `#set` lines) may be blank-adjacent — Velocity swallows a directive-only line's newline but not a truly blank one, so the rendered body stays byte-identical to one line.
export const LEDGER_API_REQUEST_TEMPLATE = `#set($assetId = $input.path('$.assetId'))
#set($idempotencyKey = $input.params('Idempotency-Key'))
#set($action = "Action=SendMessage")
#set($messageGroupId = "&MessageGroupId=$util.urlEncode($assetId)")
#set($messageBody = "&MessageBody=$util.urlEncode($input.body)")
#set($attributeName = "&MessageAttribute.1.Name=IdempotencyKey")
#set($attributeType = "&MessageAttribute.1.Value.DataType=String")
#set($attributeValue = "&MessageAttribute.1.Value.StringValue=$util.urlEncode($idempotencyKey)")
#set($body = "$action$messageGroupId$messageBody$attributeName$attributeType$attributeValue")
$body`;
