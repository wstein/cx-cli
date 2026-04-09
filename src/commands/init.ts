/**
 * `cx init` — create default project configuration files:
 *
 *   - `cx.json`           — cx CLI configuration
 *   - `repomix.config.json` — repomix output configuration
 *
 * Neither file is overwritten if it already exists; the command is idempotent.
 */

import { access, constants, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import kleur from 'kleur';

// ---------------------------------------------------------------------------
// cx.json schema
// ---------------------------------------------------------------------------

export interface CxConfig {
  $schema?: string;
  version: string;
  repomix: {
    /** Path to the repomix configuration file. */
    configFile: string;
    /** Default repomix output style. */
    outputStyle: 'xml' | 'json' | 'plain' | 'markdown';
    /** Directory where repomix output files are written. */
    outputDir: string;
  };
  bundle: {
    /** Directory where bundle metadata is stored (may be the same as outputDir). */
    outputDir: string;
    /** Create a ZIP archive after each `cx bundle` run. */
    createZip: boolean;
  };
}

const DEFAULT_CX_CONFIG: CxConfig = {
  $schema: 'https://raw.githubusercontent.com/wstein/cx-cli/main/schemas/cx.schema.json',
  version: '1',
  repomix: {
    configFile: 'repomix.config.json',
    outputStyle: 'xml',
    outputDir: 'bundles',
  },
  bundle: {
    outputDir: 'bundles',
    createZip: false,
  },
};

// ---------------------------------------------------------------------------
// repomix.config.json schema
// ---------------------------------------------------------------------------

interface RepomixConfig {
  $schema: string;
  input: {
    maxFileSize: number;
  };
  output: {
    filePath: string;
    style: string;
    parsableStyle: boolean;
    fileSummary: boolean;
    directoryStructure: boolean;
    files: boolean;
    removeComments: boolean;
    removeEmptyLines: boolean;
    compress: boolean;
    topFilesLength: number;
    showLineNumbers: boolean;
    truncateBase64: boolean;
    copyToClipboard: boolean;
    includeFullDirectoryStructure: boolean;
    tokenCountTree: boolean;
    git: {
      sortByChanges: boolean;
      sortByChangesMaxCommits: number;
      includeDiffs: boolean;
      includeLogs: boolean;
      includeLogsCount: number;
    };
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

const DEFAULT_REPOMIX_CONFIG: RepomixConfig = {
  $schema: 'https://repomix.com/schemas/latest/schema.json',
  input: {
    maxFileSize: 52428800,
  },
  output: {
    filePath: 'repomix-output.xml.txt',
    style: 'xml',
    parsableStyle: false,
    fileSummary: true,
    directoryStructure: true,
    files: true,
    removeComments: false,
    removeEmptyLines: false,
    compress: false,
    topFilesLength: 5,
    showLineNumbers: false,
    truncateBase64: false,
    copyToClipboard: false,
    includeFullDirectoryStructure: false,
    tokenCountTree: false,
    git: {
      sortByChanges: true,
      sortByChangesMaxCommits: 100,
      includeDiffs: false,
      includeLogs: false,
      includeLogsCount: 50,
    },
  },
  include: [],
  ignore: {
    useGitignore: true,
    useDotIgnore: true,
    useDefaultPatterns: true,
    customPatterns: [],
  },
  security: {
    enableSecurityCheck: true,
  },
  tokenCount: {
    encoding: 'o200k_base',
  },
};

const DEFAULT_REPOMIX_IGNORE = `# Add patterns to ignore here, one per line
# Example:
# *.log
# tmp/
`;

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export interface InitCommandOptions {
  /** Working directory; defaults to `process.cwd()`. */
  cwd?: string;
}

/**
 * Execute the `init` command.
 *
 * @param options  Command options.
 */
export async function runInit(options: InitCommandOptions = {}): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd());

  console.log(kleur.cyan(`Initialising in: ${cwd}`));

  const createdFiles: string[] = [];

  // cx.json
  const cxConfigPath = join(cwd, 'cx.json');
  if (await fileExists(cxConfigPath)) {
    console.log(kleur.dim('  cx.json already exists, skipping.'));
  } else {
    await writeFile(cxConfigPath, JSON.stringify(DEFAULT_CX_CONFIG, null, 2) + '\n', 'utf8');
    console.log(kleur.green('  ✓ cx.json'));
    createdFiles.push('cx.json');
  }

  // repomix.config.json
  const repomixConfigPath = join(cwd, 'repomix.config.json');
  if (await fileExists(repomixConfigPath)) {
    console.log(kleur.dim('  repomix.config.json already exists, skipping.'));
  } else {
    await writeFile(
      repomixConfigPath,
      JSON.stringify(DEFAULT_REPOMIX_CONFIG, null, 2) + '\n',
      'utf8',
    );
    console.log(kleur.green('  ✓ repomix.config.json'));
    createdFiles.push('repomix.config.json');
  }

  // .repomixignore
  const repomixIgnorePath = join(cwd, '.repomixignore');
  if (await fileExists(repomixIgnorePath)) {
    console.log(kleur.dim('  .repomixignore already exists, skipping.'));
  } else {
    await writeFile(repomixIgnorePath, DEFAULT_REPOMIX_IGNORE, 'utf8');
    console.log(kleur.green('  ✓ .repomixignore'));
    createdFiles.push('.repomixignore');
  }

  if (createdFiles.length > 0) {
    console.log(kleur.green(`\nInitialisation complete. Run \`cx bundle <path>\` to get started.`));
  } else {
    console.log(kleur.yellow('\nAll configuration files already exist. Nothing was changed.'));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
