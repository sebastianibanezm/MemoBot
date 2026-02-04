import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getMemoryById } from "@/lib/services/memory";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { id } = await params;

  const memory = await getMemoryById(userId, id);
  if (!memory) notFound();

  const supabase = createServerSupabase();
  let categoryName: string | null = null;
  if (memory.category_id) {
    const { data: cat } = await supabase
      .from("categories")
      .select("name")
      .eq("id", memory.category_id)
      .single();
    categoryName = cat?.name ?? null;
  }

  const { data: tagRows } = await supabase
    .from("memory_tags")
    .select("tag_id")
    .eq("memory_id", id);
  const tagIds = (tagRows ?? []).map((r) => r.tag_id);
  let tagNames: string[] = [];
  if (tagIds.length > 0) {
    const { data: tags } = await supabase
      .from("tags")
      .select("name")
      .in("id", tagIds);
    tagNames = (tags ?? []).map((t) => t.name);
  }

  return (
    <div className="p-6 pb-20 max-w-3xl mx-auto">
      {/* Back Link */}
      <Link
        href="/dashboard/memories"
        className="link-accent text-sm inline-flex items-center gap-2 mb-6"
      >
        <span>&larr;</span> BACK TO MEMORIES
      </Link>

      {/* Memory Card */}
      <article className="card-dystopian p-6">
        {/* Header */}
        <header className="mb-6 pb-4 border-b border-[var(--card-border)]">
          <h1 
            className="text-2xl font-display tracking-wider text-[var(--foreground)] mb-3"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            {memory.title || "(UNTITLED MEMORY)"}
          </h1>
          
          {/* Metadata */}
          <div className="flex flex-wrap gap-2 text-xs">
            {categoryName && (
              <span className="badge">
                {categoryName.toUpperCase()}
              </span>
            )}
            {tagNames.map((t) => (
              <span key={t} className="badge-muted">
                {t.toUpperCase()}
              </span>
            ))}
          </div>
        </header>

        {/* Summary */}
        {memory.summary && (
          <div className="mb-6 p-4 bg-[var(--background-alt)] border-l-2 border-[var(--accent)] rounded-r">
            <p className="text-sm text-[var(--muted)] italic leading-relaxed">
              {memory.summary}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-[var(--foreground)] bg-transparent p-0 border-0 text-sm leading-relaxed">
            {memory.content}
          </pre>
        </div>

        {/* Footer Metadata */}
        <footer className="mt-8 pt-4 border-t border-[var(--card-border)]">
          <div className="grid grid-cols-2 gap-4 text-xs text-[var(--muted)]">
            <div>
              <span className="text-[var(--accent)] tracking-wider">CREATED:</span>{" "}
              {new Date(memory.created_at).toLocaleString()}
            </div>
            {memory.occurred_at && (
              <div>
                <span className="text-[var(--accent)] tracking-wider">OCCURRED:</span>{" "}
                {new Date(memory.occurred_at).toLocaleString()}
              </div>
            )}
            {memory.source_platform && (
              <div>
                <span className="text-[var(--accent)] tracking-wider">SOURCE:</span>{" "}
                {memory.source_platform.toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-[var(--accent)] tracking-wider">ID:</span>{" "}
              <span className="font-mono text-[10px]">{memory.id.slice(0, 8)}...</span>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}
