import fs from "node:fs/promises";
import path from "node:path";

const UPDATE_ENV_VARS = [
  "UPDATE_SNAPSHOTS",
  "UPDATE_TEST_SNAPSHOTS",
  "CX_UPDATE_SNAPSHOTS",
];

function shouldUpdateSnapshots(): boolean {
  return UPDATE_ENV_VARS.some((name) => process.env[name] === "1");
}

type DiffOp =
  | { type: "equal"; line: string }
  | { type: "delete"; line: string }
  | { type: "insert"; line: string };

function toSnapshotLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  const normalized = value.endsWith("\n") ? value.slice(0, -1) : value;
  return normalized.length === 0 ? [] : normalized.split("\n");
}

function buildDiffOps(expected: string[], actual: string[]): DiffOp[] {
  const lcs: number[][] = Array.from({ length: expected.length + 1 }, () =>
    Array.from({ length: actual.length + 1 }, () => 0),
  );

  for (let i = expected.length - 1; i >= 0; i -= 1) {
    const currentRow = lcs[i] ?? [];
    const nextRow = lcs[i + 1] ?? [];
    for (let j = actual.length - 1; j >= 0; j -= 1) {
      if (expected[i] === actual[j]) {
        currentRow[j] = (nextRow[j + 1] ?? 0) + 1;
      } else {
        currentRow[j] = Math.max(nextRow[j] ?? 0, currentRow[j + 1] ?? 0);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < expected.length && j < actual.length) {
    const expectedLine = expected[i];
    const actualLine = actual[j];
    if (expectedLine === undefined || actualLine === undefined) {
      break;
    }

    if (expectedLine === actualLine) {
      ops.push({ type: "equal", line: expectedLine });
      i += 1;
      j += 1;
      continue;
    }

    const nextExpected = lcs[i + 1]?.[j] ?? 0;
    const nextActual = lcs[i]?.[j + 1] ?? 0;
    if (nextExpected >= nextActual) {
      ops.push({ type: "delete", line: expectedLine });
      i += 1;
    } else {
      ops.push({ type: "insert", line: actualLine });
      j += 1;
    }
  }

  while (i < expected.length) {
    const expectedLine = expected[i];
    if (expectedLine !== undefined) {
      ops.push({ type: "delete", line: expectedLine });
    }
    i += 1;
  }

  while (j < actual.length) {
    const actualLine = actual[j];
    if (actualLine !== undefined) {
      ops.push({ type: "insert", line: actualLine });
    }
    j += 1;
  }

  return ops;
}

function formatUnifiedRange(start: number, length: number): string {
  if (length === 0) {
    return `${start - 1},0`;
  }

  if (length === 1) {
    return String(start);
  }

  return `${start},${length}`;
}

function createUnifiedDiff(params: {
  expected: string;
  actual: string;
  expectedLabel: string;
  actualLabel: string;
  contextLines?: number;
}): string {
  const contextLines = params.contextLines ?? 3;
  const expectedLines = toSnapshotLines(params.expected);
  const actualLines = toSnapshotLines(params.actual);
  const ops = buildDiffOps(expectedLines, actualLines);

  const changedIndexes = ops
    .map((op, index) => (op.type === "equal" ? -1 : index))
    .filter((index) => index >= 0);

  const diffLines = [
    `--- ${params.expectedLabel}`,
    `+++ ${params.actualLabel}`,
  ];

  if (changedIndexes.length === 0) {
    return diffLines.join("\n");
  }

  const hunks: Array<{ start: number; end: number }> = [];
  for (const index of changedIndexes) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(ops.length, index + contextLines + 1);
    const previous = hunks.at(-1);
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
    } else {
      hunks.push({ start, end });
    }
  }

  for (const hunk of hunks) {
    let expectedLine = 1;
    let actualLine = 1;
    for (let index = 0; index < hunk.start; index += 1) {
      const op = ops[index];
      if (!op) {
        continue;
      }
      if (op.type !== "insert") {
        expectedLine += 1;
      }
      if (op.type !== "delete") {
        actualLine += 1;
      }
    }

    let expectedLength = 0;
    let actualLength = 0;
    const body: string[] = [];

    for (let index = hunk.start; index < hunk.end; index += 1) {
      const op = ops[index];
      if (!op) {
        continue;
      }
      switch (op.type) {
        case "equal":
          body.push(` ${op.line}`);
          expectedLength += 1;
          actualLength += 1;
          break;
        case "delete":
          body.push(`-${op.line}`);
          expectedLength += 1;
          break;
        case "insert":
          body.push(`+${op.line}`);
          actualLength += 1;
          break;
      }
    }

    diffLines.push(
      `@@ -${formatUnifiedRange(expectedLine, expectedLength)} +${formatUnifiedRange(actualLine, actualLength)} @@`,
      ...body,
    );
  }

  return diffLines.join("\n");
}

async function assertSnapshotText(
  snapshotPath: string,
  actual: string,
): Promise<void> {
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  const normalizedActual = actual.endsWith("\n") ? actual : `${actual}\n`;

  try {
    const expected = await fs.readFile(snapshotPath, "utf8");
    if (expected === normalizedActual) {
      return;
    }

    if (shouldUpdateSnapshots()) {
      await fs.writeFile(snapshotPath, normalizedActual, "utf8");
      return;
    }

    const diff = createUnifiedDiff({
      expected,
      actual: normalizedActual,
      expectedLabel: snapshotPath,
      actualLabel: "actual",
    });
    throw new Error(
      `Snapshot mismatch at ${snapshotPath}. Set UPDATE_TEST_SNAPSHOTS=1 to accept changes.\n\n${diff}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ENOENT")) {
      throw error;
    }

    await fs.writeFile(snapshotPath, normalizedActual, "utf8");
  }
}

export async function assertTextSnapshot(params: {
  snapshotPath: string;
  actual: string;
}): Promise<void> {
  await assertSnapshotText(params.snapshotPath, params.actual);
}

export async function assertJsonSnapshot(params: {
  snapshotPath: string;
  actual: unknown;
}): Promise<void> {
  const encoded = `${JSON.stringify(params.actual, null, 2)}\n`;
  await assertSnapshotText(params.snapshotPath, encoded);
}
