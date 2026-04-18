// test-lane: unit
import { describe, expect, test } from "bun:test";

import { isSubpath, toPosixPath } from "../../src/shared/paths.js";

describe("shared path utilities", () => {
  test("toPosixPath normalizes paths to posix format", () => {
    expect(toPosixPath("src/index.ts")).toBe("src/index.ts");
    expect(toPosixPath("src/lib/util.ts")).toBe("src/lib/util.ts");
    expect(toPosixPath("/home/user/project")).toBe("/home/user/project");
  });

  test("isSubpath returns true for valid child paths", () => {
    expect(isSubpath("/home/user", "/home/user/project")).toBe(true);
    expect(isSubpath("/home/user/project", "/home/user/project/src")).toBe(
      true,
    );
    expect(isSubpath("/home/user", "/home/user/a/b/c")).toBe(true);
  });

  test("isSubpath returns false for non-child paths", () => {
    expect(isSubpath("/home/user/project", "/home/user")).toBe(false);
    expect(isSubpath("/home/user", "/home/other")).toBe(false);
    expect(isSubpath("/home/user/proj", "/home/user/project")).toBe(false);
  });

  test("isSubpath returns false for absolute paths from non-parent", () => {
    expect(isSubpath("src", "/home/user/project/src")).toBe(false);
  });

  test("isSubpath returns false when parent equals child", () => {
    expect(isSubpath("/home/user/project", "/home/user/project")).toBe(false);
  });
});
