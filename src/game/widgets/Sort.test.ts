import { describe, expect, it } from "vitest";
import { assignmentsToInput } from "./Sort";

describe("Sort.assignmentsToInput", () => {
  it("maps an itemKey->binId record to the assignments array grade() expects", () => {
    expect(assignmentsToInput({ i0: "diffuses", i1: "protein" })).toEqual({
      assignments: [
        { itemKey: "i0", binId: "diffuses" },
        { itemKey: "i1", binId: "protein" },
      ],
    });
  });

  it("returns an empty array for no assignments", () => {
    expect(assignmentsToInput({})).toEqual({ assignments: [] });
  });
});
