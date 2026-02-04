/**
 * Local filesystem writer: write markdown files into category folders (Phase 7).
 */

import fs from "fs/promises";
import path from "path";

/** Sanitize for use as a directory or file name (no path separators, no leading dot). */
function sanitizeName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "Uncategorized";
}

/** Slug from title for filename, or fallback to id. */
function slugFromTitle(title: string | null, memoryId: string): string {
  if (!title || !title.trim()) return memoryId;
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
  return slug || memoryId;
}

/**
 * Write markdown content to basePath/categoryName/filename.md.
 * Creates category folder if needed. Returns relative path (categoryName/filename.md).
 */
export async function writeMemoryToLocal(
  basePath: string,
  categoryName: string,
  memoryId: string,
  title: string | null,
  markdownContent: string
): Promise<string> {
  const safeCategory = sanitizeName(categoryName);
  const filename = `${slugFromTitle(title, memoryId)}.md`;
  const dir = path.join(basePath, safeCategory);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, markdownContent, "utf8");
  return path.join(safeCategory, filename);
}
