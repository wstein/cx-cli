import {
  detectAdapterCapabilities,
  getAdapterCapabilities,
  getReferenceAdapterRuntimeInfo,
  setAdapterPath,
} from "../dist/src/adapter/capabilities.js";

async function main() {
  setAdapterPath("repomix");

  const capabilities = await getAdapterCapabilities();
  const detected = await detectAdapterCapabilities();
  const reference = await getReferenceAdapterRuntimeInfo();

  if (capabilities.oracleAdapter.modulePath !== "repomix") {
    throw new Error(
      `Expected selected oracle adapter path to be repomix, got ${capabilities.oracleAdapter.modulePath}.`,
    );
  }

  if (capabilities.oracleAdapter.packageName !== "repomix") {
    throw new Error(
      `Expected selected oracle adapter package to be repomix, got ${capabilities.oracleAdapter.packageName}.`,
    );
  }

  if (!reference.installed) {
    throw new Error("Official repomix is not installed for reference smoke.");
  }

  if (typeof capabilities.oracleAdapter.contractValid !== "boolean") {
    throw new Error("Selected oracle adapter did not return contract status.");
  }

  if (
    capabilities.oracleAdapter.contractValid === false &&
    capabilities.oracleAdapter.contractErrors.length === 0
  ) {
    throw new Error(
      "Selected oracle adapter reported an invalid contract without any errors.",
    );
  }

  if (typeof detected.hasMergeConfigs !== "boolean") {
    throw new Error(
      "Selected oracle adapter capability detection did not return booleans.",
    );
  }
}

await main();
