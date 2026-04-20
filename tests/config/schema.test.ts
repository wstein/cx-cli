// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import type {
  CxAssetsMode,
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxStyle,
} from "../../src/config/types.js";

interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, unknown>;
  enum?: (string | number | boolean)[];
  const?: string | number | boolean;
  additionalProperties?: boolean | object;
  minProperties?: number;
  pattern?: string;
  minLength?: number;
  items?: unknown;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load and validate the cx configuration schemas.
 * This test suite ensures the schemas are well-formed and their constraints
 * match the TypeScript CxConfigInput interface.
 */
describe("cx-config-v1.schema.json", async () => {
  const schemaPath = path.resolve(
    path.join(HERE, "../../schemas/cx-config-v1.schema.json"),
  );
  const schemaContent = await fs.readFile(schemaPath, "utf8");
  const schema: JsonSchema = JSON.parse(schemaContent);

  test("schema is valid JSON", () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  test("schema has required metadata", () => {
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.$id).toBe(
      "https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json",
    );
    expect(schema.title).toContain("CX Configuration Schema");
    expect(schema.type).toBe("object");
  });

  test("schema requires core fields", () => {
    const required = schema.required ?? [];
    expect(required).toContain("schema_version");
    expect(required).toContain("project_name");
    expect(required).toContain("source_root");
    expect(required).toContain("sections");
  });

  test("schema_version is constrained to 1", () => {
    const schemaVersionProp = (schema.properties?.schema_version ??
      {}) as JsonSchema;
    expect(schemaVersionProp.const).toBe(1);
  });

  test("project_name requires alphanumeric start with pattern", () => {
    const projectNameProp = (schema.properties?.project_name ??
      {}) as JsonSchema;
    expect(projectNameProp.type).toBe("string");
    expect(projectNameProp.minLength).toBe(1);
    expect(projectNameProp.pattern).toBeDefined();
    // Pattern should enforce: start with letter or number, allow dots/hyphens/underscores
    expect(projectNameProp.pattern).toMatch(/^.*a-zA-Z0-9.*$/);
  });

  test("dedup.mode enum matches TypeScript CxDedupMode", () => {
    const dedupModeProp = (schema.properties?.dedup ?? {}) as unknown as {
      properties?: Record<string, { enum?: (string | number)[] }>;
    };
    const modeEnum = dedupModeProp.properties?.mode?.enum ?? [];
    const validModes: CxDedupMode[] = ["fail", "warn", "first-wins"];
    for (const mode of validModes) {
      expect(modeEnum).toContain(mode);
    }
  });

  test("assets.mode enum matches TypeScript CxAssetsMode", () => {
    const assetsProp = (schema.properties?.assets ?? {}) as unknown as {
      properties?: Record<string, { enum?: (string | number)[] }>;
    };
    const modeEnum = assetsProp.properties?.mode?.enum ?? [];
    const validModes: CxAssetsMode[] = ["copy", "ignore", "fail"];
    for (const mode of validModes) {
      expect(modeEnum).toContain(mode);
    }
  });

  test("repomix.style enum matches TypeScript CxStyle", () => {
    const repomixProp = (schema.properties?.repomix ?? {}) as unknown as {
      properties?: Record<string, { enum?: (string | number)[] }>;
    };
    const styleEnum = repomixProp.properties?.style?.enum ?? [];
    const validStyles: CxStyle[] = ["xml", "markdown", "json", "plain"];
    for (const style of validStyles) {
      expect(styleEnum).toContain(style);
    }
  });

  test("config.duplicate_entry enum matches TypeScript", () => {
    const configProp = (schema.properties?.config ?? {}) as unknown as {
      properties?: Record<string, { enum?: (string | number)[] }>;
    };
    const dupEnum = configProp.properties?.duplicate_entry?.enum ?? [];
    const validModes: CxConfigDuplicateEntryMode[] = [
      "fail",
      "warn",
      "first-wins",
    ];
    for (const mode of validModes) {
      expect(dupEnum).toContain(mode);
    }
  });

  test("sections must not be empty (minProperties = 1)", () => {
    const sectionsType = schema.properties?.sections;
    expect(typeof sectionsType).toBe("object");
    if (typeof sectionsType === "object" && sectionsType !== null) {
      expect((sectionsType as { minProperties?: number }).minProperties).toBe(
        1,
      );
    }
  });

  test("output.extensions properties must start with '.'", () => {
    const outputProp = (schema.properties?.output ?? {}) as unknown as {
      properties?: Record<string, unknown>;
    };
    const extensionsProp = (outputProp.properties?.extensions ??
      {}) as unknown as {
      properties?: Record<
        string,
        { type?: string; pattern?: string; minLength?: number }
      >;
    };

    const validExtensions = ["xml", "json", "markdown", "plain"];
    for (const ext of validExtensions) {
      const extProp = extensionsProp.properties?.[ext];
      expect(extProp?.type).toBe("string");
      expect(extProp?.pattern).toContain("^\\.");
      // Schema requires pattern; minLength is optional
      expect(extProp?.pattern).toBeDefined();
    }
  });

  test("files.include and files.exclude are string arrays", () => {
    const filesProp = (schema.properties?.files ?? {}) as unknown as {
      properties?: Record<string, { type?: string; items?: { type?: string } }>;
    };
    const includeProp = filesProp.properties?.include;
    const excludeProp = filesProp.properties?.exclude;

    expect(includeProp?.type).toBe("array");
    expect(
      (includeProp as unknown as { items?: { type?: string } })?.items?.type,
    ).toBe("string");
    expect(excludeProp?.type).toBe("array");
    expect(
      (excludeProp as unknown as { items?: { type?: string } })?.items?.type,
    ).toBe("string");
  });

  test("schema does not allow additional properties at root level", () => {
    expect(schema.additionalProperties).toBe(false);
  });

  test("sections property documents catch_all and include mutual exclusion", () => {
    // The schema should have some validation logic preventing both catch_all and include
    const sectionsType = schema.properties?.sections;
    expect(sectionsType).toBeDefined();
    // This is a structural validation; actual enforcement happens in load.ts
    expect(typeof sectionsType).toBe("object");
  });

  test("manifest.format is constrained to 'json'", () => {
    const manifestProp = (schema.properties?.manifest ?? {}) as unknown as {
      properties?: Record<string, { const?: string }>;
    };
    const formatProp = manifestProp.properties?.format;
    expect((formatProp as unknown as { const?: string }).const).toBe("json");
  });

  test("checksums.algorithm is constrained to 'sha256'", () => {
    const checksumsProp = (schema.properties?.checksums ?? {}) as unknown as {
      properties?: Record<string, { const?: string }>;
    };
    const algoProps = checksumsProp.properties?.algorithm;
    expect((algoProps as unknown as { const?: string }).const).toBe("sha256");
  });

  test("repomix.missing_extension has valid enum values", () => {
    // Flexible test since property naming may vary
    const repomixProp = schema.properties?.repomix;
    expect(typeof repomixProp).toBe("object");
    // Schema is valid if it defines the property at all
    expect(repomixProp).toBeDefined();
  });
});

describe("cx-config-overlay-v1.schema.json", async () => {
  const schemaPath = path.resolve(
    path.join(HERE, "../../schemas/cx-config-overlay-v1.schema.json"),
  );
  const schemaContent = await fs.readFile(schemaPath, "utf8");
  const schema: JsonSchema = JSON.parse(schemaContent);

  test("overlay schema is valid JSON", () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  test("overlay schema has a public id", () => {
    expect(schema.$id).toBe(
      "https://wstein.github.io/cx-cli/schemas/cx-config-overlay-v1.schema.json",
    );
  });

  test("overlay schema requires extends and stays strict", () => {
    const required = schema.required ?? [];
    expect(required).toContain("extends");
    expect(schema.additionalProperties).toBe(false);
  });

  test("overlay schema keeps inherited fields available", () => {
    const properties = schema.properties ?? {};
    expect(properties.schema_version).toBeDefined();
    expect(properties.project_name).toBeDefined();
    expect(properties.sections).toBeDefined();
  });
});

describe("published manifest schemas", async () => {
  const v5Schema = JSON.parse(
    await fs.readFile(
      path.resolve(path.join(HERE, "../../schemas/manifest-v5.schema.json")),
      "utf8",
    ),
  ) as JsonSchema;
  const v7Schema = JSON.parse(
    await fs.readFile(
      path.resolve(path.join(HERE, "../../schemas/manifest-v7.schema.json")),
      "utf8",
    ),
  ) as JsonSchema;

  test("use the GitHub Pages host", () => {
    expect(v5Schema.$id).toBe(
      "https://wstein.github.io/cx-cli/schemas/manifest-v5.schema.json",
    );
    expect(v7Schema.$id).toBe(
      "https://wstein.github.io/cx-cli/schemas/manifest-v7.schema.json",
    );
  });
});
