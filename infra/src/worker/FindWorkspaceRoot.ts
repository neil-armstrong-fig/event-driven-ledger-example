import {existsSync} from "node:fs";
import path from "node:path";

const WORKSPACE_MARKER = "pnpm-workspace.yaml";

// Walks up from `startDir` to the pnpm workspace root, so callers don't hard-code how many
// folders deep they sit and survive `infra/` being restructured.
export function findWorkspaceRoot(startDir: string): string {
  const parent = path.dirname(startDir);

  if (existsSync(path.join(startDir, WORKSPACE_MARKER))) {
    return startDir;
  }
  if (parent === startDir) {
    throw new Error(`No ${WORKSPACE_MARKER} found above the starting directory`);
  }
  return findWorkspaceRoot(parent);
}
