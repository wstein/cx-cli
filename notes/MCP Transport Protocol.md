---
id: 20260415160000
aliases: ["MCP transport", "stdio protocol"]
tags: [mcp, transport, architecture]
---

`cx` implements the Model Context Protocol (MCP) over a standard input/output (stdio) transport layer.

The server lifecycle is managed in `src/mcp/server.ts`. It uses the `@modelcontextprotocol/sdk` to create a `McpServer` instance and binds it to `StdioServerTransport`.

Key mechanisms:
- **Initialization**: The server starts with a set of `instructions` that describe the available tools and the active configuration profile (`cx-mcp.toml` or `cx.toml`).
- **Safeguards**: Request logging and rate limiting are instantiated as middleware to protect the workspace during live agent sessions.
- **Graceful Exit**: The server listens for `SIGINT` and `SIGTERM` to ensure the transport is closed cleanly and any temporary resources are released.
- **Tool Registration**: Tools are modularized and registered via `registerCxMcpTools`, keeping the transport logic separate from tool implementation.

This stdio pattern allows any MCP-compatible client (Claude Desktop, VS Code extensions, custom agent scripts) to spawn `cx mcp` as a subprocess.

## Links

- [[Agentic Ecosystem MCP]] - The high-level role of MCP in the project.
- [[MCP Note Review Workflow]] - Using the transport for note maintenance.
- src/mcp/server.ts - Implementation of the server lifecycle.
- src/mcp/safeguards.ts - Safety middleware for the transport.
