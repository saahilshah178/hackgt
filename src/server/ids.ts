import { randomBytes } from "node:crypto";

/** Generates a lowercase snake_case id matching src/contracts/common.ts's ID_PATTERN. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}
