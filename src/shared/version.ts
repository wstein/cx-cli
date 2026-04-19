import packageJson from "../../package.json" with { type: "json" };

export const CX_VERSION = packageJson.version as string;
export const CX_DISPLAY_VERSION = `v${CX_VERSION}`;
