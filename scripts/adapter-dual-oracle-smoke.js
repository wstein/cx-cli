import {
  ADAPTER_CONTRACT,
  getAdapterCapabilities,
} from "../dist/src/adapter/capabilities.js";

async function main() {
  const capabilities = await getAdapterCapabilities();

  if (capabilities.oracleAdapter.adapterContract !== ADAPTER_CONTRACT) {
    throw new Error("Oracle adapter contract metadata is inconsistent.");
  }

  if (capabilities.oracleAdapter.packageName !== "@wsmy/repomix-cx-fork") {
    throw new Error(
      `Expected oracle adapter to remain @wsmy/repomix-cx-fork, got ${capabilities.oracleAdapter.packageName}.`,
    );
  }

  if (capabilities.referenceAdapter.packageName !== "repomix") {
    throw new Error(
      `Expected reference adapter package to be repomix, got ${capabilities.referenceAdapter.packageName}.`,
    );
  }

  if (!capabilities.referenceAdapter.installed) {
    throw new Error("Reference adapter is not installed for dual-oracle smoke.");
  }
}

await main();
