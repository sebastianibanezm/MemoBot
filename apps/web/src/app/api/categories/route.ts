import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/services/embedding";
import { syncUserToSupabase } from "@/lib/sync-user";

/** Valid neon colors for categories */
export const NEON_COLORS = [
  "neon-cyan",
  "neon-pink",
  "neon-green",
  "neon-purple",
  "neon-yellow",
  "neon-orange",
  "neon-blue",
  "neon-red",
  "neon-lime",
  "neon-magenta",
] as const;

export type NeonColor = (typeof NEON_COLORS)[number];

/**
 * GET /api/categories — list categories for the current user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, description, color, memory_count")
      .eq("user_id", userId)
      .order("memory_count", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ categories: data ?? [] });
  } catch (e) {
    console.error("[GET /api/categories]", e);
    return NextResponse.json({ error: "Failed to list categories" }, { status: 500 });
  }
}

/**
 * POST /api/categories — create a new category manually.
 * Body: { name: string, color?: NeonColor }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure user exists in database before creating category
  const user = await currentUser();
  if (user) {
    await syncUserToSupabase({
      id: user.id,
      email_addresses: user.emailAddresses?.map((e) => ({ email_address: e.emailAddress })),
      first_name: user.firstName,
      last_name: user.lastName,
      image_url: user.imageUrl,
    });
  }

  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return NextResponse.json({ error: "Name must be 50 characters or less" }, { status: 400 });
    }

    // Validate color if provided
    const categoryColor = color && NEON_COLORS.includes(color) ? color : "neon-cyan";

    const supabase = createServerSupabase();

    // Check if category with this name already exists
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Category with this name already exists" }, { status: 409 });
    }

    // Generate embedding for the category name
    const embedding = await generateEmbedding(trimmedName);

    // Create the category
    const { data, error } = await supabase
      .from("categories")
      .insert({
        user_id: userId,
        name: trimmedName,
        color: categoryColor,
        embedding,
        memory_count: 0,
      })
      .select("id, name, description, color, memory_count")
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/categories]", e);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
