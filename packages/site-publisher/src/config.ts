import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ResolveOrgHandleOptions {
  explicit?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

/** Resolve the target from an explicit override, environment, or starter config. */
export async function resolveOrgHandle({
  explicit,
  env = process.env,
  cwd = process.cwd(),
}: ResolveOrgHandleOptions = {}): Promise<string | undefined> {
  if (explicit?.trim()) return explicit;
  const fromEnvironment = env.CR_ORG_HANDLE ?? env.PUBLIC_CONTEXTROCKET_HANDLE;
  if (fromEnvironment?.trim()) return fromEnvironment;

  try {
    const config = JSON.parse(
      await readFile(resolve(cwd, "config/site.json"), "utf8"),
    ) as { contextrocket?: { handle?: unknown } };
    return typeof config.contextrocket?.handle === "string"
      ? config.contextrocket.handle
      : undefined;
  } catch {
    return undefined;
  }
}
