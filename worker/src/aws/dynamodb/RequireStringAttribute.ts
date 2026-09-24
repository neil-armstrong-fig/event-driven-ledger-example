import type {AttributeValue} from "@aws-sdk/client-dynamodb";

export function requireStringAttribute(item: Record<string, AttributeValue>, name: string): string {
  const value = item[name]?.S;
  if (value === undefined) {
    throw new Error(`Expected a string attribute "${name}" on the stored item`);
  }
  return value;
}
