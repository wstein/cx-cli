import packageJson from "../../package.json" assert { type: "json" };

export const CX_VERSION = packageJson.version as string;
