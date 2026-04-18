import { validateTestLaneHeaders } from "./test-lane-policy.js";

const { files, mismatches } = validateTestLaneHeaders();

if (mismatches.length > 0) {
  console.error("test-lanes: lane policy violations detected:");
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  process.exit(1);
}

console.log(`test-lanes: validated ${files.length} test files.`);
