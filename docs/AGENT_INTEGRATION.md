# Agent Integration Guide — CX MCP

This document explains how to integrate the `cx mcp` server with common AI agents and IDE integrations. It shows recommended, production-ready configuration patterns, security and safety notes, and troubleshooting tips. Where integrations differ across vendors, examples show the common pattern; verify the final keys with the specific client documentation before deploying.

Overview
--------

`cx mcp` exposes a deterministic, file-scoped Model Context Protocol (MCP) server over standard input/output (stdio). When started from a workspace directory it prefers a colocated `cx-mcp.toml` profile and will fall back to `cx.toml` if the MCP profile is absent. In addition to file browsing, the native server also exposes note authoring and note-graph inspection tools so agents can create and audit durable repository knowledge without leaving MCP.

Key behavior to remember
- The server is started by running `cx mcp` in the repository root (or another directory that contains a `cx-mcp.toml` or `cx.toml`).
- Transport: stdio (stdin/stdout)
- Tools exposed by the server: `list` (workspace file inventory), `grep` (content search), `read` (anchored file read), `notes_new` (create a note), `notes_update` (revise a note in place), `notes_list` (list notes), `notes_backlinks` (inspect backlinks), `notes_orphans` (find orphan notes), `notes_code_links` (inspect code references), and `notes_links` (audit unresolved links or inspect one note)
- Security boundary: `cx-mcp.toml` is the intended MCP-specific profile; `cx doctor mcp` shows the resolved profile and effective `files.include` / `files.exclude` that determine tool visibility.

Because the server communicates over stdio, clients simply need to launch `cx mcp` as a subprocess and bind to its stdin/stdout. The examples below follow that pattern.

Supported integration patterns
------------------------------

- Local IDE agent extensions that support MCP over stdio (VS Code extensions such as Cline / Roo Code / other MCP-capable extensions)
- Desktop agents that support configuring stdio MCP servers (Claude Desktop and similar)
- Custom agent frameworks (LangChain-style adapters or direct MCP clients using the upstream `@modelcontextprotocol` SDK)

Examples
--------

Note: these examples document the common, production-ready patterns. They are intentionally conservative about absolute configuration keys (different extensions use different keys). When in doubt, prefer providing the full command (`/absolute/path/to/cx`) and an explicit `cwd` set to the repository root.

1) Claude Desktop (example)

Many desktop agent apps allow a JSON configuration block to declare external MCP servers. A typical config snippet (example only — verify file path and exact key names for your Claude Desktop install) looks like:

```json
{
  "mcpServers": {
    "cx-workspace": {
      "command": "cx",
      "args": ["mcp"],
      "cwd": "${workspaceFolder}",
      "env": {
        "CX_STRICT": "true"
      }
    }
  }
}
```

Notes:
- Use an absolute path for `command` if the app runs in an environment where `PATH` differs from your interactive shell (e.g. `/usr/local/bin/cx`).
- `cwd` should point to the repository root so `cx` can find `cx-mcp.toml` or `cx.toml`.

2) VS Code and AI-centric VS Code extensions (Cline, Roo Code, Cursor adapters)

VS Code extensions vary in the JSON schema they expose for MCP servers. Many follow the same logical structure: a server name, a transport type (`stdio`), the command to run, args, and an optional `cwd` and `env`. Example (pseudoconfig for an MCP-capable extension):

```json
{
  "mcp.servers": {
    "cx-workspace": {
      "transport": "stdio",
      "command": "cx",
      "args": ["mcp"],
      "cwd": "${workspaceFolder}",
      "env": {
        "CX_STRICT": "true"
      }
    }
  }
}
```

How to apply in VS Code:
- Install the MCP-capable AI extension you want (Cline, Roo Code, Cursor-style plugin, etc.).
- Open the extension's settings or its JSON settings file and add an MCP server block using the pattern above.
- Start the extension agent; it will spawn `cx mcp` and bind to its stdio.

3) Cursor / Codex / other AI-first IDEs

Cursor and other AI-first IDEs expose either a direct MCP configuration pane or accept extension-provided MCP server declarations. Use the same `stdio` pattern: `cx mcp` as the command and the repository root as `cwd`.

4) JetBrains IDEs (IntelliJ, WebStorm, Rider) and AI plugins

JetBrains IDEs typically rely on plugin-specific configuration. If the plugin supports registering an external MCP server, register a stdio server using the `cx mcp` command. Otherwise, many JetBrains AI plugins allow a local agent to be configured via an executable path — point that to your `cx` wrapper.

5) Agent frameworks and custom adapters (LangChain, LangGraph, custom MCP client)

If you are building or adapting an agent framework to talk to `cx mcp`, prefer using the official Model Context Protocol SDKs (where available) or implement a robust stdio client that:

- spawns `cx mcp` with the correct `cwd` and `env`
- forwards stdin and reads stdout/stderr reliably
- responds to SIGINT/SIGTERM and closes the server gracefully

Example (pseudocode, conceptual):

```text
spawnProcess(command: "/usr/local/bin/cx", args: ["mcp"], cwd: "/path/to/repo", env: { CX_STRICT: "true" })
bindStdioToMcpClient(process.stdin, process.stdout)
discoverTools() -> [list, grep, read, notes_new, notes_list, notes_backlinks, notes_orphans, notes_code_links, notes_links]
```

6) Neovim / Emacs / Terminal-based workflows

The same stdio pattern works for editor integrations that can spawn a subprocess. Ensure the working directory and environment are correct, and the editor plugin is able to manage a long-running subprocess.

Security and safety
-------------------

- Limit the agent's working directory: run `cx mcp` in the repository root so `cx` can apply the intended `files.include` / `files.exclude` scope. Do not run it from a higher-level directory that would broaden the agent's visibility.
- Use a colocated `cx-mcp.toml` to create a deliberate, scoped agent profile when exposing the server to 3rd-party tools.
- Prefer `CX_STRICT=true` in CI or shared environments if you want the server to treat Category B warnings as failures.
- Audit the effective MCP profile with `cx doctor mcp --config cx.toml` before allowing production agents to connect.

Troubleshooting
---------------

- Agent cannot find `cx`: use an absolute path to the `cx` binary.
- Agent cannot find `cx-mcp.toml` or `cx.toml`: ensure `cwd` points to the repository root and the config file exists. Use `cx doctor mcp` to see the resolved profile.
- Tools missing: confirm the running server advertises `list`, `grep`, `read`, and the note tools above (these are provided by the native MCP implementation). If you need additional capabilities, build a wrapper MCP server that composes other tools, or extend `cx` itself.

Reference & crosslinks
---------------------

- Operator manual: `docs/MANUAL.md` — quick operator flows and MCP usage notes.
- Configuration reference: `docs/config-reference.md` — config precedence, `cx-mcp.toml` vs `cx.toml`, and `files.include`/`files.exclude` behavior.
- Extraction safety: `docs/EXTRACTION_SAFETY.md` — safe extraction and recovery rules.
- MCP server implementation: `src/mcp/server.ts` (server lifecycle and stdio transport) and `src/mcp/tools.ts` (registered tools and behavior).

Recommended quickstart (one-page)
--------------------------------

This quickstart is intended for non-expert operators who need a minimal, repeatable setup to connect an IDE or local agent to `cx mcp`.

1) Verify `cx` is runnable

- Open a terminal in your workspace root and run:

```bash
cx --version
```

If the command is not found, either add the `cx` binary to your `PATH` or use its absolute path (e.g. `/usr/local/bin/cx` or the `bin/cx` file in a local checkout).

2) Ensure an MCP profile exists

- Prefer a colocated `cx-mcp.toml`. If you do not need a separate MCP profile, a `cx.toml` in the workspace root is sufficient.

3) Start a test server manually

From the workspace root, start the server to confirm it launches and advertises tools:

```bash
cx mcp
```

You should see no interactive output (the process binds to stdio). Open another terminal and run diagnostics:

```bash
cx doctor mcp --config cx.toml
```

This prints the resolved profile and the effective `files.include` / `files.exclude` that govern what the agent can see.

4) Configure your client

- When configuring the client, use the `cx mcp` command as the executable and set its `cwd` to the repository root.
- Prefer an absolute `command` path if the client runs in a different environment (CI, GUI app sandbox).

5) Validate from the client

- Once the client has started the MCP connection, verify the agent can call the `list` and `read` tools for a small, permitted file. If the agent cannot see files you expect, re-run `cx doctor mcp` and check your `cwd` and config file placement.

Exact integration snippet: Claude Desktop (macOS example)
-----------------------------------------------------

On macOS the user config for Claude Desktop often lives under `~/Library/Application Support/Claude/claude_desktop_config.json`. A practical production-ready snippet follows — use an absolute path to the `cx` binary to avoid PATH differences between GUI apps and shells:

```json
{
  "mcpServers": {
    "cx-workspace": {
      "command": "/usr/local/bin/cx",
      "args": ["mcp"],
      "cwd": "/Users/<your-username>/path/to/repo",
      "env": {
        "CX_STRICT": "true"
      }
    }
  }
}
```

- Replace `/usr/local/bin/cx` with the absolute path to your `cx` binary.
- Replace the `cwd` value with the repository root. This keeps the agent scoped to the intended config file and file visibility rules.

Troubleshooting FAQ (short)
---------------------------

Q: The agent reports it cannot find the server executable.
A: Use an absolute path for `command` in your client config. GUI apps often have a different PATH than an interactive shell.

Q: The agent can connect but cannot see files I expect.
A: Confirm `cwd` is the repository root. Run `cx doctor mcp --config cx.toml` from that same directory to inspect the effective MCP profile. Verify `files.include` / `files.exclude` and section rules.

Q: The agent shows missing tools (`list`, `grep`, `read`).
A: Ensure you started the native `cx mcp` server (not a wrapper that omits tools). The native server registers these tools in `src/mcp/tools.ts`. If you need other tools, implement them as an MCP tool extension and register them with the server.

Q: The agent process terminates immediately with no output.
A: The MCP server uses stdio and typically runs as a background subprocess. Confirm you started it with the correct command and `cwd`. Check the client logs and the subprocess stderr for errors. Running `cx mcp` manually from a terminal helps identify initialization errors.

Q: I want a more restricted view for the agent — how do I scope it?
A: Create a `cx-mcp.toml` in the workspace root that narrows `files.include` and `files.exclude`. Use `cx doctor mcp` to validate the effective scope before onboarding an external agent.

Q: How do I make agents treat warnings as errors in shared environments?
A: Set `CX_STRICT=true` in the agent's environment block (or use `cx --strict` when starting the server). This forces Category B behaviors into failure mode.

Q: Any recommendations for CI or automated QA?
A: Use `cx doctor mcp` as a pre-flight check and include `cx verify` in downstream validation. Consider adding a link-checker job for docs and an automated `cx doctor` run for agent onboarding verification.

Appendix: Example `claude_desktop_config.json` fragment

```json
{
  "mcpServers": {
    "cx-workspace": { "command": "cx", "args": ["mcp"] }
  }
}
```

Note: the example above is intentionally minimal and mirrors a common pattern in several desktop clients. Always verify the file and key names with the client you are configuring.

--
This guide gives an operational baseline for integrating `cx mcp` into IDEs and agent clients. If you want, I can now add a small troubleshooting FAQ, or produce a sample `launch.json` / extension-specific snippet for a particular extension (Cline, Roo Code, Cursor). Which would you prefer next?
