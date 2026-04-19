import { defineConfig, mergeConfig } from "vitest/config";

const coverageExclude = [
  "dist/**",
  "coverage/**",
  "node_modules/**",
  "tests/helpers/**",
  "scripts/**",
  "**/*.d.ts",
];

const baseConfig = defineConfig({
  test: {
    environment: "node",
  },
});

export interface CxVitestConfigOptions {
  include: string[];
  reportsDirectory: string;
  coverageEnabled?: boolean;
}

export function defineCxVitestConfig(
  options: CxVitestConfigOptions,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return mergeConfig(
    mergeConfig(
      baseConfig,
      defineConfig({
        test: {
          include: options.include,
          coverage: {
            enabled: options.coverageEnabled ?? false,
            provider: "v8",
            reporter: ["text", "json-summary", "html", "lcov"],
            reportsDirectory: options.reportsDirectory,
            exclude: coverageExclude,
            all: true,
          } as Record<string, unknown>,
        },
      }),
    ),
    overrides,
  );
}
