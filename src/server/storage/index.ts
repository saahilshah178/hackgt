import type { GameSpec } from "../../contracts/gamespec";
import type { StorageDriver } from "../../contracts/storage";
import { getEnv } from "../env";
import { validateGameSpec } from "../../pipeline/validate/validate-gamespec";
import { LocalDriver } from "./local";
import { SupabaseDriver } from "./supabase";

export { LocalDriver } from "./local";
export { SupabaseDriver } from "./supabase";

let cached: StorageDriver | undefined;

/** Memoized storage driver, chosen by STORAGE_DRIVER (default "local"). */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const driver = getEnv().STORAGE_DRIVER;
  cached = driver === "supabase" ? new SupabaseDriver() : new LocalDriver();
  return cached;
}

/** Test hook: forget the memoized driver so a test can point DATA_DIR elsewhere or switch drivers. */
export function resetStorage(): void {
  cached = undefined;
}

/** Loads the stored GameSpec for a game id, re-validated, or null when unknown or invalid. */
export async function getGameSpecById(id: string): Promise<GameSpec | null> {
  const record = await getStorage().getGame(id);
  if (!record) return null;
  const result = validateGameSpec(record.spec);
  return result.ok ? result.spec : null;
}
