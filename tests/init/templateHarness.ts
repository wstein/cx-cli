import fs from "node:fs/promises";
import path from "node:path";
import { runInitCommand } from "../../src/cli/commands/init.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

export async function generateTemplateWorkspace(params: {
  template: string;
  projectName: string;
  files: Record<string, string>;
}) {
  const workspace = await createWorkspace({
    files: params.files,
  });
  const capture = createBufferedCommandIo({ cwd: workspace.rootDir });
  const exitCode = await runInitCommand(
    {
      force: true,
      interactive: false,
      stdout: false,
      templateList: false,
      name: params.projectName,
      style: "xml",
      template: params.template,
    },
    capture.io,
  );

  return {
    workspace,
    capture,
    exitCode,
    read(relativePath: string) {
      return fs.readFile(path.join(workspace.rootDir, relativePath), "utf8");
    },
    exists(relativePath: string) {
      return fs
        .access(path.join(workspace.rootDir, relativePath))
        .then(() => true)
        .catch(() => false);
    },
  };
}
