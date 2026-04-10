import { CxError } from "../shared/errors.js";

export function assertSafeProjectName(projectName: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(projectName)) {
    throw new CxError(
      "project_name must be filesystem-safe and use only letters, numbers, dot, underscore, or hyphen.",
    );
  }
}
