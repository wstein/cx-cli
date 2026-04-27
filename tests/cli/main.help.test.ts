// test-lane: integration

import { describe, expect, test } from "vitest";
import {
  COMMAND_DESCRIPTIONS,
  COMMAND_GROUPS,
  type CommandName,
  main,
} from "../../src/cli/main.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

function extractGroupedDescriptions(output: string): Map<string, string> {
  const descriptions = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^ {2}(\S+)\s{2,}(.+)$/u.exec(line);
    if (match) {
      descriptions.set(match[1] ?? "", match[2] ?? "");
    }
  }
  return descriptions;
}

describe("main help grouping", () => {
  test("grouped command descriptions match registered command descriptions", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(["--help"], capture.io);

    expect(exitCode).toBe(0);
    const grouped = extractGroupedDescriptions(capture.stdout());
    const expectedCommands = COMMAND_GROUPS.flatMap((group) => group.commands);

    expect([...grouped.keys()].sort()).toEqual([...expectedCommands].sort());
    for (const command of expectedCommands) {
      expect(grouped.get(command)).toBe(
        COMMAND_DESCRIPTIONS[command as CommandName],
      );
    }
  });
});
