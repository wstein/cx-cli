/**
 * Types for the external oracle/reference seam only.
 *
 * The native proof path does not depend on these runtime adapter types during
 * ordinary bundle, validate, verify, or extract execution.
 */
export interface AdapterRenderConfig {
  output: {
    filePath: string;
    style: "xml" | "markdown" | "json" | "plain";
    parsableStyle: boolean;
    headerText: string;
    fileSummary: boolean;
    directoryStructure: boolean;
    files: boolean;
    removeComments: boolean;
    removeEmptyLines: boolean;
    compress: boolean;
    showLineNumbers: boolean;
    copyToClipboard: boolean;
    includeEmptyDirectories: boolean;
    includeFullDirectoryStructure: boolean;
    git: {
      includeDiffs: boolean;
      includeLogs: boolean;
      includeLogsCount: number;
      sortByChanges: boolean;
      sortByChangesMaxCommits: number;
    };
    topFilesLength: number;
    truncateBase64: boolean;
    tokenCountTree: boolean;
  };
  include: string[];
  ignore: {
    useGitignore: boolean;
    useDotIgnore: boolean;
    useDefaultPatterns: boolean;
    customPatterns: string[];
  };
  security: {
    enableSecurityCheck: boolean;
  };
  tokenCount: {
    encoding: string;
  };
}

export interface AdapterStructuredEntry {
  path: string;
  content: string;
  metadata: {
    tokenCount?: number;
    language?: string;
  };
}

export interface AdapterRenderedFileSpan {
  path: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
}

export interface AdapterStructuredPack {
  entries: AdapterStructuredEntry[];
  render(style: "xml" | "markdown" | "json" | "plain"): Promise<string>;
  renderWithMap?: (style: "xml" | "markdown" | "json" | "plain") => Promise<{
    output: string;
    files: AdapterRenderedFileSpan[];
  }>;
}

export interface SuspiciousFileResult {
  type?: string;
  filePath: string;
  messages: string[];
}

export interface AdapterModule {
  mergeConfigs?: (
    rootDir: string,
    fileConfig: Record<string, unknown>,
    cliConfig: AdapterRenderConfig,
  ) => AdapterRenderConfig;
  pack?: (
    rootDirs: string[],
    config: AdapterRenderConfig,
    progress: (...args: unknown[]) => void,
    options: Record<string, unknown>,
    explicitFiles: string[],
  ) => Promise<void>;
  packStructured?: (
    rootDirs: string[],
    config: AdapterRenderConfig,
    options: {
      explicitFiles: string[];
    },
  ) => Promise<AdapterStructuredPack>;
  runSecurityCheck?: (
    files: Array<{ path: string; content: string }>,
  ) => Promise<SuspiciousFileResult[]>;
}
