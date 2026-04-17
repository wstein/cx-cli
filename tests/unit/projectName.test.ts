import { describe, expect, test } from "bun:test";

import { assertSafeProjectName } from "../../src/config/projectName.js";

describe("config project name validation", () => {
  test("assertSafeProjectName accepts valid names", () => {
    expect(() => assertSafeProjectName("demo")).not.toThrow();
    expect(() => assertSafeProjectName("my-project")).not.toThrow();
    expect(() => assertSafeProjectName("my_project")).not.toThrow();
    expect(() => assertSafeProjectName("MyProject")).not.toThrow();
    expect(() => assertSafeProjectName("project123")).not.toThrow();
    expect(() => assertSafeProjectName("p.r.o.j")).not.toThrow();
  });

  test("assertSafeProjectName rejects names starting with non-alphanumeric", () => {
    expect(() => assertSafeProjectName("-project")).toThrow();
    expect(() => assertSafeProjectName("_project")).toThrow();
    expect(() => assertSafeProjectName(".project")).toThrow();
    expect(() => assertSafeProjectName("1project")).not.toThrow();
  });

  test("assertSafeProjectName rejects names with invalid characters", () => {
    expect(() => assertSafeProjectName("project@name")).toThrow();
    expect(() => assertSafeProjectName("project name")).toThrow();
    expect(() => assertSafeProjectName("project/name")).toThrow();
    expect(() => assertSafeProjectName("project\\name")).toThrow();
    expect(() => assertSafeProjectName("project:name")).toThrow();
  });

  test("assertSafeProjectName rejects empty names", () => {
    expect(() => assertSafeProjectName("")).toThrow();
  });
});
