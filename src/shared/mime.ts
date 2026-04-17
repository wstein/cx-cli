import path from "node:path";

const MIME_TYPES = new Map<string, string>([
  [".c", "text/x-c"],
  [".cc", "text/x-c++"],
  [".cpp", "text/x-c++"],
  [".css", "text/css"],
  [".go", "text/x-go"],
  [".gif", "image/gif"],
  [".gz", "application/gzip"],
  [".h", "text/x-c"],
  [".html", "text/html"],
  [".java", "text/x-java-source"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".kt", "text/x-kotlin"],
  [".mjs", "text/javascript"],
  [".md", "text/markdown"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".py", "text/x-python"],
  [".rs", "text/x-rust"],
  [".svg", "image/svg+xml"],
  [".toml", "text/toml"],
  [".ts", "text/typescript"],
  [".tsx", "text/typescript"],
  [".txt", "text/plain"],
  [".wav", "audio/wav"],
  [".webp", "image/webp"],
  [".xml", "application/xml"],
  [".yaml", "text/yaml"],
  [".yml", "text/yaml"],
]);

export function detectMediaType(
  filePath: string,
  kind: "text" | "asset" = "asset",
): string {
  const extension = path.extname(filePath).toLowerCase();

  // If extension is in the map, use it
  const mediaType = MIME_TYPES.get(extension);
  if (mediaType !== undefined) {
    return mediaType;
  }

  // If no extension or empty, return text/plain
  if (extension === "") {
    return "text/plain";
  }

  // For unknown extensions, return based on kind
  return kind === "asset" ? "application/octet-stream" : "text/plain";
}
