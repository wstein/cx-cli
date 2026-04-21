import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { CxMcpWorkspace } from "../workspace.js";
import { registerBundleTools } from "./bundle.js";
import { registerDoctorTools } from "./doctor.js";
import { registerExtractTools } from "./extract.js";
import { registerNotesTools } from "./notes.js";
import { registerWorkspaceTools } from "./workspace.js";

export function registerCxMcpTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerWorkspaceTools(server, workspace);
  registerBundleTools(server, workspace);
  registerExtractTools(server, workspace);
  registerDoctorTools(server, workspace);
  registerNotesTools(server, workspace);
}
