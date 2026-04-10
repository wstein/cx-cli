import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

export function isSubpath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}
