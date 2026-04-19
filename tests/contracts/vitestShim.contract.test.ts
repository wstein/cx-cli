// test-lane: contract
import { afterEach, describe, expect, mock, test } from "bun:test";

afterEach(() => {
  mock.restore();
});

describe("Vitest bun:test shim contract", () => {
  test("mock.module overrides a later dynamic import", async () => {
    const specifier = new URL(
      "../fixtures/vitest/mockModuleTarget.ts",
      import.meta.url,
    ).href;

    mock.module(specifier, () => ({
      mode: "mocked",
      readMode: () => "mocked",
    }));

    const loaded = await import(specifier);

    expect(loaded.mode).toBe("mocked");
    expect(loaded.readMode()).toBe("mocked");
  });
});
