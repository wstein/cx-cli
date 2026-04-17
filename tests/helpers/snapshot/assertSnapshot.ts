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

    throw new Error(
      `Snapshot mismatch at ${snapshotPath}. Set UPDATE_TEST_SNAPSHOTS=1 to accept changes.`,
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
