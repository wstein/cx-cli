// test-lane: contract

import { describe, expect, test } from "vitest";
import { getBuiltinNotesExtractProfiles } from "../../src/notes/extract.js";

describe("notes extract built-in profiles contract", () => {
  test("freezes the built-in profile names and default target paths", () => {
    const profiles = getBuiltinNotesExtractProfiles();

    expect(
      Object.keys(profiles).sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    ).toEqual(["arc42", "manual", "onboarding"]);

    expect(profiles.arc42?.targetPaths).toEqual([
      "docs/modules/ROOT/pages/architecture/index.adoc",
    ]);
    expect(profiles.onboarding?.targetPaths).toEqual([
      "docs/modules/ROOT/pages/start-here/docs-index.adoc",
    ]);
    expect(profiles.manual?.targetPaths).toEqual([
      "docs/modules/ROOT/pages/manual/operator-manual.adoc",
    ]);
  });
});
