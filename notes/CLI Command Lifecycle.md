---
id: 20260415163000
aliases: ["cli lifecycle", "command dispatch"]
tags: [cli, architecture, workflow]
target: current
---
The CLI command lifecycle in `cx` is built on `yargs` and a centralized command dispatch model.

The main entrypoint is `src/cli/main.ts`. It constructs the CLI parser, sets global options, and wires each command to a dedicated handler function.

Key behavior:
- **Global options and overrides**: `--adapter-path`, `--strict`, and `--lenient` are registered globally and applied through middleware before any command runs.
- **Middleware-driven configuration**: The CLI middleware uses `setCLIOverrides()` to inject `--strict` and `--lenient` behavior into the config loading pipeline.
- **Command registration**: Each command is implemented in its own module (`runBundleCommand`, `runMcpCommand`, `runNotesCommand`, etc.), which keeps the command surface modular and testable.
- **Injected command boundaries**: Command handlers are moving toward explicit `CommandIo` and workspace context inputs so tests do not need to mutate `process.stdout`, `process.stderr`, `process.env`, or `process.chdir()` as the normal execution path.
- **Safe stdout handling**: `writeStdoutSafe()` protects the CLI from `EPIPE` errors when output is piped to a closed receiver.
- **Non-process exit mode**: `yargs().exitProcess(false)` allows the application to control exit behavior explicitly, improving testability and subprocess integration.
- **Strict validation**: `strict()`, `strictCommands()`, and `strictOptions()` enforce unrecognized input failure handling.

This lifecycle ensures that the CLI is both robust for automation and explicit about how user input affects the runtime configuration. The current modernization goal is not to replace `yargs`, but to keep shrinking the amount of ambient process state that command paths rely on.

## Links

- [[Config Inheritance and Overlays]] - CLI flags can override config behavior.
- [[Environment Variable Resolution]] - CLI flags are the highest precedence in the config stack.
- src/cli/main.ts - Implementation of the command lifecycle.
- src/config/env.ts - CLI flag override plumbing.
