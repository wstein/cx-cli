/**
 * Professional shell completion generation for cx CLI.
 * Provides properly formatted completions for bash, zsh, and fish.
 */

type ShellKind = "bash" | "zsh" | "fish";

interface CommandInfo {
  name: string;
  description: string;
  alias?: string;
}

interface GlobalOption {
  name: string;
  description: string;
  type?: "string" | "boolean";
  choices?: string[];
}

const COMMANDS: CommandInfo[] = [
  { name: "init", description: "Create a starter cx.toml and scaffold repository notes" },
  { name: "inspect", description: "Show the computed plan without writing files" },
  { name: "bundle", description: "Create a bundle directory from a project" },
  { name: "list", description: "List bundle contents grouped by section" },
  { name: "validate", description: "Validate bundle structure and schema" },
  { name: "verify", description: "Verify bundle integrity and optional source-tree drift" },
  { name: "extract", description: "Restore files from a bundle" },
  { name: "mcp", description: "Start the MCP server for agentic workflows" },
  { name: "doctor", description: "Diagnose overlaps, MCP inheritance, and secret hygiene" },
  { name: "render", description: "Render planned sections without building a full bundle" },
  { name: "config", description: "Inspect effective configuration" },
  { name: "completion", description: "Generate shell completion scripts for bash, zsh, or fish" },
  { name: "notes", description: "Create notes, list them, and inspect note graph relationships" },
  { name: "adapter", description: "Inspect adapter capabilities and runtime state" },
];

const GLOBAL_OPTIONS: GlobalOption[] = [
  { name: "--help", description: "Show help message" },
  { name: "-h", description: "Show help message" },
  { name: "--version", description: "Show version" },
  { name: "-v", description: "Show version" },
  { name: "--strict", description: "Force all Category B behaviors to fail fast (CI mode)", type: "boolean" },
  { name: "--lenient", description: "Set all Category B behaviors to warn", type: "boolean" },
  { name: "--adapter-path", description: "Path to custom Repomix adapter module", type: "string" },
];

/**
 * Generate bash completion script with descriptions
 */
function generateBashCompletion(): string {
  const commandEntries = COMMANDS.map(
    (cmd) => `    "${cmd.name}" \\`,
  ).join("\n");

  return `###-begin-cx-completions-###
#
# cx command completion script (bash)
# Professional completion with descriptions
#
_cx_yargs_completions() {
  local cur prev words cword
  _init_completion || return

  local -a commands=(
${commandEntries.slice(0, -3)}
  )

  if [[ \$cword -eq 1 ]]; then
    COMPREPLY=($(compgen -W "\${commands[*]}" -- "\$cur"))
    return
  fi

  # Delegate to yargs for option handling
  COMPREPLY=( $(COMP_CWORD="\$cword" COMP_LINE="\$COMP_LINE" COMP_POINT="\$COMP_POINT" cx --get-yargs-completions "\${words[@]}") )
}

complete -o default -F _cx_yargs_completions cx
###-end-cx-completions-###
`;
}

/**
 * Generate zsh completion script with descriptions
 */
function generateZshCompletion(): string {
  const commandLines = COMMANDS.map(
    (cmd) => `    "${cmd.name}:${cmd.description}"`,
  ).join("\n");

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
    '--adapter-path[Path to custom Repomix adapter module]:path:_files' \
    '1: :_cx_commands' \
    '*:: :->args'

  case \$state in
    args)
      local cmd=\${line[1]}
      case \$cmd in
        bundle|inspect|verify)
          _arguments '--config[Configuration file]:file:_files' --json --update --force
          ;;
        extract)
          _arguments '--file[File to extract]:file' '--to[Destination path]:path:_files -/'
          ;;
        init)
          _arguments --force --interactive --json --stdout --name --style
          ;;
        *)
          COMP_CWORD=\$((CURRENT-1)) COMP_LINE="\$BUFFER" COMP_POINT=\$CURSOR cx --get-yargs-completions \${words[@]}
          ;;
      esac
      ;;
  esac
}

compdef _cx cx
###-end-cx-completions-###
`;
}

/**
 * Generate fish completion script with descriptions
 */
function generateFishCompletion(): string {
  const commandLines = COMMANDS.map(
    (cmd) => `complete -c cx -f -n "__fish_seen_subcommand_from" -a "${cmd.name}" -d "${cmd.description.replace(/"/g, '\\"')}"`,
  ).join("\n");

  const optionLines = GLOBAL_OPTIONS.map(
    (opt) => `complete -c cx -n "not __fish_seen_subcommand_from ${COMMANDS.map((c) => c.name).join(" ")}" -l ${opt.name.replace(/^--?/, "")} -d "${opt.description.replace(/"/g, '\\"')}"`,
  )
    .filter((line) => !line.includes(" -l "))
    .join("\n");

  return `###-begin-cx-completions-###
#
# cx command completion script (fish)
# Professional completion with descriptions
#

# Commands
${commandLines}

# Global options
complete -c cx -n "not __fish_seen_subcommand_from ${COMMANDS.map((c) => c.name).join(" ")}" -s h -l help -d "Show help message"
complete -c cx -n "not __fish_seen_subcommand_from ${COMMANDS.map((c) => c.name).join(" ")}" -s v -l version -d "Show version"
complete -c cx -n "not __fish_seen_subcommand_from ${COMMANDS.map((c) => c.name).join(" ")}" -l strict -d "Force all Category B behaviors to fail fast (CI mode)"
complete -c cx -n "not __fish_seen_subcommand_from ${COMMANDS.map((c) => c.name).join(" ")}" -l lenient -d "Set all Category B behaviors to warn"
complete -c cx -n "not __fish_seen_subcommand_from ${COMMANDS.map((c) => c.name).join(" ")}" -l adapter-path -d "Path to custom Repomix adapter module" -x

# Command-specific completions
complete -c cx -n "__fish_seen_subcommand_from bundle inspect verify" -l config -d "Configuration file" -x
complete -c cx -n "__fish_seen_subcommand_from bundle inspect verify" -l json -d "Output as JSON"
complete -c cx -n "__fish_seen_subcommand_from bundle" -l update -d "Apply differential update"
complete -c cx -n "__fish_seen_subcommand_from bundle" -l force -d "Override safety check"
complete -c cx -n "__fish_seen_subcommand_from extract" -l file -d "File to extract" -x
complete -c cx -n "__fish_seen_subcommand_from extract" -l to -d "Destination path" -x
complete -c cx -n "__fish_seen_subcommand_from init" -l name -d "Project name" -x
complete -c cx -n "__fish_seen_subcommand_from init" -l style -d "Output style" -a "xml markdown json plain"
complete -c cx -n "__fish_seen_subcommand_from init" -l force -d "Force overwrite"
complete -c cx -n "__fish_seen_subcommand_from init" -l interactive -d "Interactive mode"
complete -c cx -n "__fish_seen_subcommand_from init" -l json -d "Output as JSON"
complete -c cx -n "__fish_seen_subcommand_from init" -l stdout -d "Print to stdout"
complete -c cx -n "__fish_seen_subcommand_from inspection" -l token-breakdown -d "Show token distribution"
complete -c cx -n "__fish_seen_subcommand_from completion" -l shell -d "Shell type" -a "bash zsh fish"

###-end-cx-completions-###
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
