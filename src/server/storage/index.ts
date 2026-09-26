import type { GameSpec } from "../../contracts/gamespec";
import type { StorageDriver } from "../../contracts/storage";

/*
 * TODO(overnight): stub until P5a lands the LocalDriver / SupabaseDriver (pipeline-dev owns this folder).
 * The runtime (/play/[id]) only depends on getGameSpecById(); keep that signature.
 */
export function getStorage(): StorageDriver {
  throw new Error("storage driver not implemented yet (P5a)");
}

/** Returns the stored GameSpec for a game id, or null when unknown. Fixture ids are resolved by the page itself. */
export async function getGameSpecById(_id: string): Promise<GameSpec | null> {
  return null;
}
