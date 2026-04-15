import { describe, expect, test } from "bun:test";

import { detectMediaType } from "../../src/shared/mime.js";

describe("shared MIME type detection", () => {
  test("detectMediaType returns correct MIME for common text files", () => {
    expect(detectMediaType("file.ts", "text")).toBe("text/typescript");
    expect(detectMediaType("file.js", "text")).toBe("text/javascript");
    expect(detectMediaType("file.json", "text")).toBe("application/json");
    expect(detectMediaType("file.md", "text")).toBe("text/markdown");
    expect(detectMediaType("file.py", "text")).toBe("text/x-python");
    expect(detectMediaType("file.rs", "text")).toBe("text/x-rust");
    expect(detectMediaType("file.go", "text")).toBe("text/x-go");
    expect(detectMediaType("file.java", "text")).toBe("text/x-java-source");
  });

  test("detectMediaType returns correct MIME for image assets", () => {
    expect(detectMediaType("image.png", "asset")).toBe("image/png");
    expect(detectMediaType("image.jpg", "asset")).toBe("image/jpeg");
    expect(detectMediaType("image.jpeg", "asset")).toBe("image/jpeg");
    expect(detectMediaType("image.gif", "asset")).toBe("image/gif");
    expect(detectMediaType("image.webp", "asset")).toBe("image/webp");
    expect(detectMediaType("image.svg", "asset")).toBe("image/svg+xml");
  });

  test("detectMediaType is case-insensitive for extensions", () => {
    expect(detectMediaType("FILE.TS", "text")).toBe("text/typescript");
    expect(detectMediaType("file.MD", "text")).toBe("text/markdown");
    expect(detectMediaType("IMAGE.PNG", "asset")).toBe("image/png");
  });

  test("detectMediaType returns text/plain for unknown text files", () => {
    expect(detectMediaType("file.unknown", "text")).toBe("text/plain");
    expect(detectMediaType("file", "text")).toBe("text/plain");
  });

  test("detectMediaType returns application/octet-stream for unknown assets", () => {
    expect(detectMediaType("file.unknown", "asset")).toBe(
      "application/octet-stream",
    );
    expect(detectMediaType("file", "asset")).toBe("application/octet-stream");
  });

  test("detectMediaType handles YAML extensions", () => {
    expect(detectMediaType("config.yml", "text")).toBe("application/yaml");
    expect(detectMediaType("config.yaml", "text")).toBe("application/yaml");
  });

  test("detectMediaType handles TOML files", () => {
    expect(detectMediaType("config.toml", "text")).toBe("application/toml");
  });
});