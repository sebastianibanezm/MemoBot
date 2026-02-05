/**
 * MemoBot tool handlers: execute agent tools with user/session context (PLAN.md).
 */

import OpenAI from "openai";
import { createServerSupabase } from "../lib/supabase/server";
import { generateEmbedding } from "../lib/services/embedding";
import { assignCategory, previewCategory, incrementCategoryMemoryCount } from "../lib/services/categorizer";
import {
  extractAndAssignTags,
  getOrCreateTags,
  previewTags,
} from "../lib/services/tagger";
import { findRelatedMemories, createRelationships } from "../lib/services/relationship";
import { syncMemoryToStorage } from "../lib/services/sync";
import {
  RAG_NETWORK_DEFAULTS,
  RAG_SEMANTIC_DEFAULTS,
  RAG_CONTEXT_DEFAULTS,
} from "../lib/rag-config";
import {
  createReminder,
  listReminders,
  cancelReminder,
} from "../lib/services/reminders";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

export interface ToolContext {
  userId: string;
  sessionId: string;
  platform: "whatsapp" | "telegram" | "web";
}

async function generateTitleAndSummary(content: string): Promise<{ title: string; summary: string }> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Given this memory content, respond with exactly two short lines:\nLine 1: A brief title (max 8 words).\nLine 2: A one-sentence summary (max 25 words).\n\nContent:\n${content.slice(0, 2000)}`,
      },
    ],
  });
  const text = response.choices[0]?.message?.content ?? "";
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines[0]?.replace(/^title:?\s*/i, "").slice(0, 100) || "Untitled";
  const summary = lines[1]?.replace(/^summary:?\s*/i, "").slice(0, 200) || content.slice(0, 150);
  return { title, summary };
}

export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const { userId, sessionId } = context;
  const supabase = createServerSupabase();

  await supabase.rpc("set_current_user_id", { user_id: userId });

  switch (toolName) {
    case "search_memories": {
      const query = String(toolInput.query ?? "");
      const limit = Math.min(10, Number(toolInput.limit) || RAG_NETWORK_DEFAULTS.initialCount);
      const includeRelated = toolInput.include_related !== false;
      const embedding = await generateEmbedding(query);

      if (includeRelated) {
        // Try network search first (semantic + relationships)
        const { data } = await supabase.rpc("get_memory_network", {
          p_user_id: userId,
          query_embedding: embedding,
          initial_count: limit,
          related_count: RAG_NETWORK_DEFAULTS.relatedCount,
          similarity_threshold: RAG_NETWORK_DEFAULTS.similarityThreshold,
        });
        
        // If network search found results, return them
        if (data && data.length > 0) {
          return formatMemoryResults(data as MemoryNetworkRow[]);
        }
        
        // Fallback to hybrid search (keyword + semantic) when network search fails
        const { data: hybridData } = await supabase.rpc("hybrid_search_memories", {
          p_user_id: userId,
          query_text: query,
          query_embedding: embedding,
          match_count: limit,
          full_text_weight: 1.5, // Boost keyword matching in fallback
          semantic_weight: 1.0,
          rrf_k: 50,
        });
        
        if (hybridData && hybridData.length > 0) {
          // Filter out low-relevance results - hybrid scores below this threshold are likely irrelevant
          // RRF scores typically range from 0 to ~0.04 (with rrf_k=50), so 0.01 is a reasonable minimum
          const MIN_HYBRID_SCORE = 0.01;
          const filteredData = (hybridData as HybridMemoryRow[]).filter(
            (m) => m.score && m.score >= MIN_HYBRID_SCORE
          );
          
          if (filteredData.length > 0) {
            return formatHybridResults(filteredData);
          }
        }
        
        return { memories: [], message: "No memories found" };
      }
      const { data } = await supabase.rpc("match_memories", {
        p_user_id: userId,
        query_embedding: embedding,
        match_count: limit,
        match_threshold: RAG_SEMANTIC_DEFAULTS.matchThreshold,
      });
      return formatMemoryResultsFromMatch((data ?? []) as MatchMemoryRow[]);
    }

    case "get_memory_by_id": {
      const memoryId = String(toolInput.memory_id ?? "");
      const { data, error } = await supabase
        .from("memories")
        .select(
          `
          *,
          category:categories(name),
          memory_tags(tag:tags(name))
        `
        )
        .eq("user_id", userId)
        .eq("id", memoryId)
        .is("deleted_at", null)
        .single();
      if (error || !data) return { error: "Memory not found" };
      return formatSingleMemory(data as MemoryWithRelations);
    }

    case "list_recent_memories": {
      const limit = Math.min(20, Math.max(1, Number(toolInput.limit) || 5));
      const categoryName = toolInput.category ? String(toolInput.category) : undefined;
      let categoryId: string | null = null;
      if (categoryName) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("user_id", userId)
          .ilike("name", categoryName)
          .limit(1)
          .maybeSingle();
        categoryId = cat?.id ?? null;
      }
      let q = supabase
        .from("memories")
        .select(
          "id, title, summary, created_at, category_id, category:categories(name), memory_tags(tag:tags(name))"
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data } = await q;
      return formatMemoryList((data ?? []) as unknown as MemoryListRow[]);
    }

    case "list_categories": {
      const { data } = await supabase
        .from("categories")
        .select("name, description, memory_count")
        .eq("user_id", userId)
        .order("memory_count", { ascending: false });
      return { categories: data ?? [] };
    }

    case "list_tags": {
      const limit = Math.min(50, Math.max(1, Number(toolInput.limit) || 20));
      const { data } = await supabase
        .from("tags")
        .select("name, usage_count")
        .eq("user_id", userId)
        .order("usage_count", { ascending: false })
        .limit(limit);
      return { tags: data ?? [] };
    }

    case "start_memory_capture": {
      const initialContent = toolInput.initial_content ? String(toolInput.initial_content) : undefined;
      console.log("[start_memory_capture] Starting capture with initial content:", initialContent?.slice(0, 100));
      
      const { error: updateError } = await supabase
        .from("conversation_sessions")
        .update({
          current_state: "MEMORY_CAPTURE",
          memory_draft: {
            content_parts: initialContent ? [initialContent] : [],
            started_at: new Date().toISOString(),
            enrichment_count: 0,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      
      if (updateError) {
        console.error("[start_memory_capture] Failed to update session:", updateError.message);
        return { error: "Failed to start memory capture" };
      }
      
      console.log("[start_memory_capture] Successfully started capture for session:", sessionId);
      return {
        status: "capture_started",
        message: initialContent
          ? "Got it! Can you tell me more about this?"
          : "What would you like to remember?",
        suggested_buttons: [{ id: "save_memory", title: "Save Memory" }],
      };
    }

    case "add_to_memory_draft": {
      const content = String(toolInput.content ?? "");
      const isAnswer = Boolean(toolInput.is_answer_to_question);
      const { data: session } = await supabase
        .from("conversation_sessions")
        .select("memory_draft")
        .eq("id", sessionId)
        .single();
      const draft = (session?.memory_draft as DraftShape | null) ?? { content_parts: [], enrichment_count: 0 };
      const parts = Array.isArray(draft.content_parts) ? [...draft.content_parts, content] : [content];
      const enrichmentCount = (draft.enrichment_count ?? 0) + (isAnswer ? 1 : 0);
      await supabase
        .from("conversation_sessions")
        .update({
          memory_draft: { ...draft, content_parts: parts, enrichment_count: enrichmentCount },
          current_state: "MEMORY_ENRICHMENT",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      return { 
        status: "content_added", 
        enrichment_count: enrichmentCount, 
        total_parts: parts.length,
        suggested_buttons: [{ id: "save_memory", title: "Save Memory" }],
      };
    }

    case "generate_memory_draft": {
      console.log("[generate_memory_draft] Generating draft for session:", sessionId);
      const { data: session } = await supabase
        .from("conversation_sessions")
        .select("memory_draft, current_state")
        .eq("id", sessionId)
        .single();
      
      console.log("[generate_memory_draft] Current state:", session?.current_state);
      const draft = session?.memory_draft as DraftShape | null;
      const parts = draft?.content_parts;
      
      if (!Array.isArray(parts) || parts.length === 0) {
        console.log("[generate_memory_draft] No content captured yet");
        return { error: "No content captured yet. Please start by telling me what you'd like to remember." };
      }
      
      console.log("[generate_memory_draft] Found", parts.length, "content parts");
      const fullContent = parts.join("\n\n");

      const { title, summary } = await generateTitleAndSummary(fullContent);

      const { data: categories } = await supabase
        .from("categories")
        .select("id, name, embedding")
        .eq("user_id", userId);
      const categoryPreview = await previewCategory(
        fullContent,
        (categories ?? []) as { id: string; name: string; embedding?: number[] | null }[]
      );

      const { data: tagsData } = await supabase.from("tags").select("name, embedding").eq("user_id", userId);
      const tagsPreview = await previewTags(
        fullContent,
        (tagsData ?? []) as { name: string; embedding?: number[] | null }[],
        5
      );

      await supabase
        .from("conversation_sessions")
        .update({
          current_state: "MEMORY_DRAFT",
          memory_draft: {
            ...draft,
            content_parts: parts,
            title,
            summary,
            full_content: fullContent,
            preview_category: categoryPreview,
            preview_tags: tagsPreview,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      return {
        status: "draft_ready",
        draft: {
          title,
          summary,
          content_preview:
            fullContent.slice(0, 200) + (fullContent.length > 200 ? "..." : ""),
          category: categoryPreview,
          tags: tagsPreview,
        },
      };
    }

    case "finalize_memory": {
      const titleOverride = toolInput.title ? String(toolInput.title) : undefined;
      const categoryOverride = toolInput.category_override
        ? String(toolInput.category_override)
        : undefined;
      const tagsOverride = Array.isArray(toolInput.tags_override)
        ? (toolInput.tags_override as string[])
        : undefined;

      // Read the draft
      const { data: session } = await supabase
        .from("conversation_sessions")
        .select("memory_draft, current_state")
        .eq("id", sessionId)
        .single();
      
      const currentState = session?.current_state;
      const draft = session?.memory_draft as DraftShape | null;
      const fullContent = draft?.full_content;
      
      // Check if already saving (using a flag in the draft)
      if (draft?.saving_in_progress) {
        console.log("[finalize_memory] Memory is currently being saved, please wait");
        return { status: "saving_in_progress", message: "Memory is being saved, please wait..." };
      }
      
      // Check if proper flow was followed - should be in MEMORY_DRAFT state
      if (currentState !== "MEMORY_DRAFT" && currentState !== "MEMORY_ENRICHMENT" && currentState !== "MEMORY_CAPTURE") {
        console.log(`[finalize_memory] Invalid state for finalization: ${currentState}`);
        return { 
          error: "no_draft", 
          message: "No memory draft to save. Please tell me what you'd like to remember first, and I'll help you capture it." 
        };
      }
      
      let generatedFullContent = fullContent;
      let generatedTitle = draft?.title as string | undefined;
      let generatedSummary = draft?.summary as string | undefined;
      
      if (!generatedFullContent) {
        // Draft exists but full_content not generated yet - auto-generate it now
        if (draft?.content_parts && Array.isArray(draft.content_parts) && draft.content_parts.length > 0) {
          console.log("[finalize_memory] Auto-generating draft from content_parts");
          generatedFullContent = draft.content_parts.join("\n\n");
          
          // Generate title and summary if not already done
          if (!generatedTitle || !generatedSummary) {
            const generated = await generateTitleAndSummary(generatedFullContent);
            generatedTitle = generatedTitle || generated.title;
            generatedSummary = generatedSummary || generated.summary;
          }
        }
      }
      
      if (!generatedFullContent) {
        // Check if a memory was recently created (draft might have been cleared)
        const { data: recentMemory } = await supabase
          .from("memories")
          .select("id, title, content, created_at")
          .eq("user_id", userId)
          .eq("source_platform", context.platform)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (recentMemory && recentMemory.length > 0) {
          // Check if this memory was created in the last 60 seconds
          const createdAt = new Date(recentMemory[0].created_at || 0);
          const now = new Date();
          const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
          
          if (diffSeconds < 60) {
            // Memory was likely just saved
            return {
              status: "memory_saved",
              memory: {
                id: recentMemory[0].id,
                title: recentMemory[0].title,
                content_preview:
                  recentMemory[0].content.slice(0, CONTENT_PREVIEW_LEN) +
                  (recentMemory[0].content.length > CONTENT_PREVIEW_LEN ? "..." : ""),
              },
              suggested_buttons: [
                { id: "create_reminder", title: "Create Reminder" },
                { id: "new_memory", title: "New Memory" },
              ],
            };
          }
        }
        return { error: "no_draft", message: "No memory draft to save. Please tell me what you'd like to remember." };
      }

      // Check for duplicate content FIRST before doing anything else
      const { data: existingMemories } = await supabase
        .from("memories")
        .select("id, title, content")
        .eq("user_id", userId)
        .eq("content", generatedFullContent)
        .is("deleted_at", null)
        .limit(1);

      if (existingMemories && existingMemories.length > 0) {
        console.log(
          `[finalize_memory] Duplicate detected - memory with same content already exists: ${existingMemories[0].id}`
        );
        // Clear draft since memory already exists, but store ID for reminder
        await supabase
          .from("conversation_sessions")
          .update({
            current_state: "CONVERSATION",
            memory_draft: { last_created_memory_id: existingMemories[0].id, last_created_memory_title: existingMemories[0].title },
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        return {
          status: "memory_saved",
          memory: {
            id: existingMemories[0].id,
            title: existingMemories[0].title,
            content_preview:
              existingMemories[0].content.slice(0, CONTENT_PREVIEW_LEN) +
              (existingMemories[0].content.length > CONTENT_PREVIEW_LEN ? "..." : ""),
          },
          suggested_buttons: [
            { id: "create_reminder", title: "Create Reminder" },
            { id: "new_memory", title: "New Memory" },
          ],
        };
      }

      // Set saving_in_progress flag to prevent concurrent processing
      const { error: flagError } = await supabase
        .from("conversation_sessions")
        .update({
          memory_draft: { ...draft, saving_in_progress: true },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (flagError) {
        console.error("[finalize_memory] Failed to set saving flag:", flagError.message);
        // Continue anyway - the duplicate check should prevent issues
      }

      try {
        const embedding = await generateEmbedding(generatedFullContent);
        const category = await assignCategory(
          userId,
          categoryOverride ?? generatedFullContent
        );
        const tags = tagsOverride
          ? await getOrCreateTags(userId, tagsOverride)
          : await extractAndAssignTags(userId, generatedFullContent);

        const { data: memory, error: memError } = await supabase
          .from("memories")
          .insert({
            user_id: userId,
            title: titleOverride ?? generatedTitle ?? "Untitled",
            content: generatedFullContent,
            summary: generatedSummary ?? null,
            embedding,
            category_id: category.id,
            source_platform: context.platform,
          })
          .select()
          .single();

        if (memError) {
          // Clear saving flag so user can retry
          await supabase
            .from("conversation_sessions")
            .update({
              memory_draft: { ...draft, saving_in_progress: false },
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
          console.error("[finalize_memory] Failed to save memory:", memError.message);
          return { error: "Failed to save memory. Please try again." };
        }

        await supabase.from("memory_tags").insert(
          tags.map((t) => ({ memory_id: memory.id, tag_id: t.id }))
        );

        // Find and create relationships to similar memories
        let related: { id: string; similarity_score: number }[] = [];
        try {
          related = await findRelatedMemories(userId, memory.id, embedding);
          console.log(
            `[finalize_memory] Found ${related.length} related memories for memory ${memory.id}`,
            related.map((r) => ({ id: r.id, score: r.similarity_score }))
          );
          await createRelationships(memory.id, related);
          console.log(`[finalize_memory] Created relationships for memory ${memory.id}`);
        } catch (relError) {
          console.error(
            `[finalize_memory] Failed to create relationships for memory ${memory.id}:`,
            relError instanceof Error ? relError.message : relError
          );
        }
        await incrementCategoryMemoryCount(userId, category.id);
        syncMemoryToStorage(userId, memory, category, tags).catch(() => {});

        // Clear draft and reset state ONLY after successful save
        // Store last_created_memory_id so "Create Reminder" button can reference it
        await supabase
          .from("conversation_sessions")
          .update({
            current_state: "CONVERSATION",
            memory_draft: { last_created_memory_id: memory.id, last_created_memory_title: memory.title },
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        return {
          status: "memory_saved",
          memory: {
            id: memory.id,
            title: memory.title,
            content_preview: generatedFullContent.slice(0, CONTENT_PREVIEW_LEN) + (generatedFullContent.length > CONTENT_PREVIEW_LEN ? "..." : ""),
            category: category.name,
            tags: tags.map((t) => t.name),
            related_count: related.length,
          },
          suggested_buttons: [
            { id: "create_reminder", title: "Create Reminder" },
            { id: "new_memory", title: "New Memory" },
          ],
        };
      } catch (err) {
        // Clear saving flag so user can retry
        await supabase
          .from("conversation_sessions")
          .update({
            memory_draft: { ...draft, saving_in_progress: false },
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
        console.error("[finalize_memory] Unexpected error:", err);
        return { error: "Failed to save memory. Please try again." };
      }
    }

    case "cancel_memory_draft": {
      await supabase
        .from("conversation_sessions")
        .update({
          current_state: "CONVERSATION",
          memory_draft: {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      return { status: "draft_cancelled" };
    }

    case "update_memory": {
      const memoryId = String(toolInput.memory_id ?? "");
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (toolInput.title !== undefined) updates.title = toolInput.title;
      if (toolInput.summary !== undefined) updates.summary = toolInput.summary;
      if (toolInput.content !== undefined) {
        updates.content = toolInput.content;
        updates.embedding = await generateEmbedding(String(toolInput.content));
      }
      if (toolInput.category !== undefined) {
        const cat = await assignCategory(userId, String(toolInput.category));
        updates.category_id = cat.id;
      }
      if (Array.isArray(toolInput.tags)) {
        const tagRows = await getOrCreateTags(userId, toolInput.tags as string[]);
        await supabase.from("memory_tags").delete().eq("memory_id", memoryId);
        if (tagRows.length)
          await supabase
            .from("memory_tags")
            .insert(tagRows.map((t) => ({ memory_id: memoryId, tag_id: t.id })));
      }
      const { error } = await supabase
        .from("memories")
        .update(updates)
        .eq("id", memoryId)
        .eq("user_id", userId);
      if (error) return { error: "Failed to update memory" };
      return { status: "memory_updated" };
    }

    case "delete_memory": {
      const memoryId = String(toolInput.memory_id ?? "");
      const { error } = await supabase
        .from("memories")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", memoryId)
        .eq("user_id", userId);
      if (error) return { error: "Failed to delete memory" };
      return { status: "memory_deleted" };
    }

    case "get_session_state": {
      const { data: sess } = await supabase
        .from("conversation_sessions")
        .select("current_state, memory_draft")
        .eq("id", sessionId)
        .single();
      const d = sess?.memory_draft as DraftShape | null;
      const parts = d?.content_parts;
      return {
        state: sess?.current_state ?? "CONVERSATION",
        has_draft: Array.isArray(parts) && parts.length > 0,
        draft_parts: Array.isArray(parts) ? parts.length : 0,
      };
    }

    case "set_session_state": {
      const state = String(toolInput.state ?? "");
      await supabase
        .from("conversation_sessions")
        .update({
          current_state: state,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      return { status: "state_updated", new_state: state };
    }

    // ========== REMINDER TOOLS ==========

    case "suggest_reminder": {
      const memoryId = String(toolInput.memory_id ?? "");
      const suggestedTime = String(toolInput.suggested_time ?? "");
      const reasoning = String(toolInput.reasoning ?? "");

      // Verify memory exists
      const { data: memory, error: memError } = await supabase
        .from("memories")
        .select("id, title")
        .eq("user_id", userId)
        .eq("id", memoryId)
        .is("deleted_at", null)
        .single();

      if (memError || !memory) {
        return { error: "Memory not found" };
      }

      // Parse the suggested time
      const remindAt = new Date(suggestedTime);
      if (isNaN(remindAt.getTime())) {
        return { error: "Invalid suggested time" };
      }

      const formattedDate = remindAt.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        status: "reminder_suggested",
        suggestion: {
          memory_id: memoryId,
          memory_title: memory.title,
          suggested_time: suggestedTime,
          formatted_time: formattedDate,
          reasoning,
        },
        message: `I noticed this memory mentions something time-sensitive: ${reasoning}\n\nWould you like me to set a reminder for ${formattedDate}?`,
      };
    }

    case "create_reminder": {
      const memoryId = String(toolInput.memory_id ?? "");
      const remindAt = String(toolInput.remind_at ?? "");
      const title = String(toolInput.title ?? "");
      const summary = toolInput.summary ? String(toolInput.summary) : null;
      const channels = Array.isArray(toolInput.channels)
        ? (toolInput.channels as string[]).filter((c) =>
            ["whatsapp", "telegram", "email"].includes(c)
          )
        : ["email"];

      console.log("[create_reminder] Called with:", { memoryId, remindAt, title, channels });

      if (!memoryId) {
        console.error("[create_reminder] Missing memory_id");
        return { error: "Missing memory_id. Please specify which memory to set a reminder for." };
      }

      // Verify memory exists
      const { data: memory, error: memError } = await supabase
        .from("memories")
        .select("id, title")
        .eq("user_id", userId)
        .eq("id", memoryId)
        .is("deleted_at", null)
        .single();

      if (memError || !memory) {
        console.error("[create_reminder] Memory not found:", memoryId, memError?.message);
        return { error: "Memory not found. The memory may have been deleted." };
      }

      // Parse the remind_at time
      const remindAtDate = new Date(remindAt);
      if (isNaN(remindAtDate.getTime())) {
        console.error("[create_reminder] Invalid remind_at:", remindAt);
        return { error: "Invalid reminder time. Please provide a valid date and time." };
      }

      try {
        const reminder = await createReminder({
          userId,
          memoryId,
          title,
          summary,
          remindAt: remindAtDate,
          channels: channels as ("whatsapp" | "telegram" | "email")[],
        });

        const formattedDate = remindAtDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return {
          status: "reminder_created",
          reminder: {
            id: reminder.id,
            title: reminder.title,
            remind_at: reminder.remind_at,
            formatted_time: formattedDate,
            channels: reminder.channels,
            memory_title: memory.title,
          },
          message: `Reminder set for ${formattedDate}. I'll notify you via ${channels.join(", ")}.`,
        };
      } catch (err) {
        console.error("[create_reminder] Failed to create reminder:", err instanceof Error ? err.message : err);
        return { error: "Failed to create reminder. Please try again." };
      }
    }

    case "list_reminders": {
      const upcomingOnly = toolInput.upcoming_only !== false;
      const limit = Math.min(20, Math.max(1, Number(toolInput.limit) || 10));

      try {
        const reminders = await listReminders(userId, {
          upcoming: upcomingOnly,
          limit,
        });

        if (reminders.length === 0) {
          return {
            reminders: [],
            message: upcomingOnly
              ? "You don't have any upcoming reminders."
              : "You don't have any reminders yet.",
          };
        }

        return {
          reminders: reminders.map((r) => ({
            id: r.id,
            title: r.title,
            summary: r.summary,
            remind_at: r.remind_at,
            formatted_time: new Date(r.remind_at).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            status: r.status,
            channels: r.channels,
            memory_title: r.memory?.title ?? null,
          })),
        };
      } catch (err) {
        console.error("Failed to list reminders:", err);
        return { error: "Failed to list reminders" };
      }
    }

    case "cancel_reminder": {
      const reminderId = String(toolInput.reminder_id ?? "");

      try {
        const cancelled = await cancelReminder(userId, reminderId);
        return {
          status: "reminder_cancelled",
          reminder: {
            id: cancelled.id,
            title: cancelled.title,
          },
          message: `Reminder "${cancelled.title}" has been cancelled.`,
        };
      } catch (err) {
        console.error("Failed to cancel reminder:", err);
        return { error: "Reminder not found or could not be cancelled" };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// --- types and formatters ---

interface DraftShape {
  content_parts?: string[];
  enrichment_count?: number;
  title?: string;
  summary?: string;
  full_content?: string;
  preview_category?: string;
  preview_tags?: string[];
  saving_in_progress?: boolean;
}

interface MemoryNetworkRow {
  id: string;
  title: string | null;
  content: string;
  degree?: number;
  relevance_score?: number;
  created_at?: string;
}

interface MatchMemoryRow {
  id: string;
  title: string | null;
  content: string;
  similarity?: number;
  created_at?: string;
}

interface HybridMemoryRow {
  id: string;
  title: string | null;
  content: string;
  score?: number;
  created_at?: string;
}

interface MemoryWithRelations {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  created_at: string;
  category?: { name: string } | null;
  memory_tags?: { tag: { name: string } }[];
}

interface MemoryListRow {
  id: string;
  title: string | null;
  summary: string | null;
  created_at: string;
  category?: { name: string } | { name: string }[] | null;
  memory_tags?: { tag: { name: string } | { name: string }[] }[];
}

const CONTENT_PREVIEW_LEN = RAG_CONTEXT_DEFAULTS.contentPreviewLength;

function formatMemoryResults(rows: MemoryNetworkRow[]): unknown {
  if (!rows?.length) return { memories: [], message: "No memories found" };
  return {
    memories: rows.map((m) => ({
      id: m.id,
      title: m.title,
      content_preview: m.content?.slice(0, CONTENT_PREVIEW_LEN) + (m.content && m.content.length > CONTENT_PREVIEW_LEN ? "..." : ""),
      degree: m.degree,
      relevance: m.relevance_score,
    })),
  };
}

function formatMemoryResultsFromMatch(rows: MatchMemoryRow[]): unknown {
  if (!rows?.length) return { memories: [], message: "No memories found" };
  return {
    memories: rows.map((m) => ({
      id: m.id,
      title: m.title,
      content_preview: m.content?.slice(0, CONTENT_PREVIEW_LEN) + (m.content && m.content.length > CONTENT_PREVIEW_LEN ? "..." : ""),
      similarity: m.similarity,
    })),
  };
}

function formatHybridResults(rows: HybridMemoryRow[]): unknown {
  if (!rows?.length) return { memories: [], message: "No memories found" };
  return {
    memories: rows.map((m) => ({
      id: m.id,
      title: m.title,
      content_preview: m.content?.slice(0, CONTENT_PREVIEW_LEN) + (m.content && m.content.length > CONTENT_PREVIEW_LEN ? "..." : ""),
      score: m.score,
    })),
  };
}

function formatSingleMemory(data: MemoryWithRelations): unknown {
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    summary: data.summary,
    category: data.category?.name ?? null,
    tags: (data.memory_tags ?? []).map((t) => t.tag?.name).filter(Boolean),
    created_at: data.created_at,
  };
}

function formatMemoryList(rows: MemoryListRow[]): unknown {
  return {
    memories: (rows ?? []).map((m) => {
      const cat = m.category;
      const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
      const tags = (m.memory_tags ?? []).map((t) => {
        const tag = t.tag;
        return Array.isArray(tag) ? tag[0]?.name : tag?.name;
      }).filter(Boolean);
      return {
        id: m.id,
        title: m.title,
        summary: m.summary,
        category: categoryName ?? null,
        tags,
        created_at: m.created_at,
      };
    }),
  };
}
