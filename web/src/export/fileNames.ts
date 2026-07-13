export function exportFileStem(fileName: string | null): string {
  const sourceName = fileName?.trim() || "glance";
  const stem = sourceName
    .replace(/\.[^./\\]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return stem || "glance";
}
