/**
 * Professional shell completion generation for cx CLI.
 * Provides properly formatted completions for bash, zsh, and fish.
 */

type ShellKind = "bash" | "zsh" | "fish";

interface CommandOption {
  name: string;
  short?: string;
  description: string;
  takesValue?: boolean;
  choices?: string[];
}

interface CommandSpec {
  name: string;
  description: string;
  options: CommandOption[];
}

const COMMANDS: CommandSpec[] = [
  {
    name: "init",
    description: "Create a starter cx.toml and scaffold repository notes",
    options: [
      { name: "force", description: "Force overwrite existing files" },
      { name: "interactive", description: "Prompt for configuration details" },
      { name: "json", description: "Output as JSON" },
      { name: "name", description: "Project name", takesValue: true },
      {
        name: "stdout",
        description: "Print to stdout instead of writing files",
      },
      {
        name: "style",
        description: "Output style format",
        takesValue: true,
        choices: ["xml", "markdown", "json", "plain"],
      },
    ],
  },
  {
    name: "inspect",
    description: "Show the computed plan without writing files",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
      {
        name: "token-breakdown",
        description: "Show per-section token distribution",
      },
      {
        name: "layout",
        description: "Asset layout override",
        takesValue: true,
        choices: ["flat", "deep"],
      },
    ],
  },
  {
    name: "bundle",
    description: "Create a bundle directory from a project",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
      {
        name: "update",
        description: "Apply differential update and prune orphaned artifacts",
      },
      {
        name: "force",
        description: "Bundle with uncommitted changes (records forced_dirty)",
      },
      {
        name: "layout",
        description: "Asset layout override",
        takesValue: true,
        choices: ["flat", "deep"],
      },
    ],
  },
  {
    name: "list",
    description: "List bundle contents grouped by section",
    options: [
      {
        name: "bundle",
        description: "Bundle directory path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "validate",
    description: "Validate bundle structure and schema",
    options: [
      {
        name: "bundle",
        description: "Bundle directory path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "verify",
    description: "Verify bundle integrity and optional source-tree drift",
    options: [
      {
        name: "bundle",
        description: "Bundle directory path",
        takesValue: true,
      },
      {
        name: "against",
        description: "Source tree path to verify against",
        takesValue: true,
      },
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
      { name: "allow-degraded", description: "Allow degraded extraction" },
    ],
  },
  {
    name: "extract",
    description: "Restore files from a bundle",
    options: [
      {
        name: "bundle",
        description: "Bundle directory path",
        takesValue: true,
      },
      { name: "file", description: "File path to extract", takesValue: true },
      { name: "to", description: "Destination directory", takesValue: true },
      { name: "json", description: "Output as JSON" },
      { name: "allow-degraded", description: "Allow degraded extraction" },
    ],
  },
  {
    name: "mcp",
    description: "Start the MCP server for agentic workflows",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "doctor",
    description: "Diagnose overlaps, MCP inheritance, and secret hygiene",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "render",
    description: "Render planned sections without building a full bundle",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "config",
    description: "Inspect effective configuration",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "completion",
    description: "Generate shell completion scripts for bash, zsh, or fish",
    options: [
      {
        name: "shell",
        short: "s",
        description: "Shell type",
        takesValue: true,
        choices: ["bash", "zsh", "fish"],
      },
    ],
  },
  {
    name: "notes",
    description:
      "Create, read, update, rename, delete, list, and inspect note graph relationships",
    options: [
      {
        name: "config",
        description: "Configuration file path",
        takesValue: true,
      },
      { name: "json", description: "Output as JSON" },
    ],
  },
  {
    name: "adapter",
    description: "Inspect adapter capabilities and runtime state",
    options: [{ name: "json", description: "Output as JSON" }],
  },
];

const GLOBAL_OPTIONS: CommandOption[] = [
  { name: "help", short: "h", description: "Show help message" },
  { name: "version", short: "v", description: "Show version" },
  {
    name: "strict",
    description: "Force all Category B behaviors to fail fast (CI mode)",
  },
  { name: "lenient", description: "Set all Category B behaviors to warn" },
  {
    name: "adapter-path",
    description: "Path to custom adapter oracle module",
    takesValue: true,
  },
];

function getAllCommandNames(): string[] {
  return COMMANDS.map((cmd) => cmd.name);
}

function _getCommandByName(name: string): CommandSpec | undefined {
  return COMMANDS.find((cmd) => cmd.name === name);
}

/**
 * Generate bash completion script
 */
function generateBashCompletion(): string {
  const commandNames = getAllCommandNames();
  const commandList = commandNames.join(" ");

  let completionLogic = "";
  for (const cmd of COMMANDS) {
    const optFlags = cmd.options
      .filter((opt) => !opt.takesValue)
      .map((opt) => `--${opt.name}`)
      .join(" ");
    const optWithValue = cmd.options
      .filter((opt) => opt.takesValue)
      .map((opt) => `--${opt.name}=`)
      .join(" ");

    completionLogic += `    ${cmd.name}) _options="${optFlags}${optWithValue ? ` ${optWithValue}` : ""}" ;;\n`;
  }

  return `###-begin-cx-completions-###
#
# cx command completion script (bash)
# Professional completion with descriptions
#
_cx_completions() {
  local cur prev words cword
  _init_completion || return

  local commands="${commandList}"
  local global_opts="--help --version --strict --lenient --adapter-path"
  local _options=""

  # First argument: complete commands
  if [[ $cword -eq 1 ]]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return
  fi

  # Subsequent arguments: complete options for the selected command
  local cmd="\${words[1]}"
  case "$cmd" in
${completionLogic}  esac

  # Combine command-specific options with global options
  _options="$_options $global_opts"

  # Complete options
  if [[ "$cur" == -* ]]; then
    COMPREPLY=($(compgen -W "$_options" -- "$cur"))
    return
  fi

  # Complete option values (e.g., file paths)
  case "$prev" in
    --config|--bundle|--to|--against|--adapter-path)
      _filedir
      return
      ;;
    --shell|--style|--layout)
      local choices=""
      case "$prev" in
        --shell) choices="bash zsh fish" ;;
        --style) choices="xml markdown json plain" ;;
        --layout) choices="flat deep" ;;
      esac
      COMPREPLY=($(compgen -W "$choices" -- "$cur"))
      return
      ;;
  esac
}

complete -o default -F _cx_completions cx
###-end-cx-completions-###
`;
}

/**
 * Generate zsh completion script
 */
function generateZshCompletion(): string {
  const commandLines = COMMANDS.map(
    (cmd) => `    "${cmd.name}:${cmd.description}"`,
  ).join("\n");

  let subcommandCompletion = "";
  for (const cmd of COMMANDS) {
    const options = cmd.options
      .map((opt) => {
        const optStr = `--${opt.name}`;
        const desc = opt.description.replace(/"/g, '\\"');
        if (opt.choices) {
          return `'${optStr}[${desc}]:(${opt.choices.join("|")}):(${opt.choices.join(" ")})'`;
        }
        return opt.takesValue
          ? `'${optStr}[${desc}]:value:'`
          : `'${optStr}[${desc}]'`;
      })
      .join(" \\\n        ");

    subcommandCompletion += `      ${cmd.name})\n        _arguments \\\n        ${options}\n        ;;\n`;
  }

  return `#compdef cx

###-begin-cx-completions-###
#
# cx command completion script (zsh)
# Professional completion with descriptions
#

_cx_commands() {
  local -a commands=(
${commandLines}
  )
  _describe 'cx commands' commands
}

_cx() {
  local context state line

  _arguments \
    '(-h --help)'{-h,--help}'[Show help message]' \
    '(-v --version)'{-v,--version}'[Show version]' \
    '--strict[Force all Category B behaviors to fail fast (CI mode)]' \
    '--lenient[Set all Category B behaviors to warn]' \
    '--adapter-path[Path to custom adapter oracle module]:path:_files' \
    '1: :_cx_commands' \
    '*:: :->subcmd'

  case $state in
    subcmd)
      local subcmd=\${line[1]}
      case $subcmd in
${subcommandCompletion}      esac
      ;;
  esac
}

compdef _cx cx
###-end-cx-completions-###
`;
}

/**
 * Generate fish completion script
 */
function generateFishCompletion(): string {
  const commandNames = getAllCommandNames();
  const commandList = commandNames.join(" ");

  let commands = "";
  for (const cmd of COMMANDS) {
    const desc = cmd.description.replace(/"/g, '\\"');
    commands += `complete -c cx -f -n "not __fish_seen_subcommand_from ${commandList}" -a "${cmd.name}" -d "${desc}"\n`;
  }

  let globalOptions = "";
  for (const opt of GLOBAL_OPTIONS) {
    const rawDesc = opt.description.replace(/"/g, '\\"');
    const name = opt.name;
    const short = opt.short ? ` -s ${opt.short}` : "";
    const longForm = `--${name}`;
    const longDesc = `${longForm}${opt.short ? ` (-${opt.short})` : ""} ${rawDesc}`;
    globalOptions += `complete -c cx -n "not __fish_seen_subcommand_from ${commandList}"${short} -l ${name} -d "${longDesc}"\n`;
  }

  let commandOptions = "";
  for (const cmd of COMMANDS) {
    for (const opt of cmd.options) {
      const desc = opt.description.replace(/"/g, '\\"');
      const name = opt.name;
      const short = opt.short ? ` -s ${opt.short}` : "";
      const takesValue = opt.takesValue ? " -x" : "";
      const choices = opt.choices ? ` -a "${opt.choices.join(" ")}"` : "";
      commandOptions += `complete -c cx -n "__fish_seen_subcommand_from ${cmd.name}"${short} -l ${name} -d "${desc}"${choices}${takesValue}\n`;
    }
  }

  return `###-begin-cx-completions-###
#
# cx command completion script (fish)
# Professional completion with descriptions
#

# Commands
${commands}
# Global options
${globalOptions}
# Command-specific options
${commandOptions}###-end-cx-completions-###
`;
}

/**
 * Render completion script for the specified shell
 */
export function renderCompletionScript(shell: ShellKind): string {
  switch (shell) {
    case "bash":
      return generateBashCompletion();
    case "zsh":
      return generateZshCompletion();
    case "fish":
      return generateFishCompletion();
  }
}
