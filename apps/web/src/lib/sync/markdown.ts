/**
 * Markdown generator for memories: YAML frontmatter + body (Phase 7).
 */

export interface MemoryForMarkdown {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  occurred_at?: string | null;
  source_platform?: string | null;
}

/**
 * Generate a markdown string for a memory with YAML frontmatter.
 * Format: ---\n yaml \n---\n\n content
 */
export function generateMemoryMarkdown(
  memory: MemoryForMarkdown,
  categoryName: string,
  tagNames: string[]
): string {
  const frontmatter: Record<string, unknown> = {
    id: memory.id,
    title: memory.title ?? "Untitled",
    summary: memory.summary ?? null,
    category: categoryName,
    tags: tagNames.length ? tagNames : null,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
    occurred_at: memory.occurred_at ?? null,
    source_platform: memory.source_platform ?? null,
  };
  const yaml = formatFrontmatter(frontmatter);
  return `---\n${yaml}\n---\n\n${memory.content}\n`;
}

function formatFrontmatter(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => quoteYaml(String(v))).join(", ")}]`);
    } else if (typeof value === "string") {
      const escaped = value.includes("\n") || value.includes(":") ? quoteYaml(value) : value;
      lines.push(`${key}: ${escaped}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

function quoteYaml(s: string): string {
  if (s.includes('"')) return `'${s.replace(/'/g, "''")}'`;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
