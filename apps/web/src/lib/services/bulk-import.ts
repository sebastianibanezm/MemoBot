/**
 * Bulk Import Service: processes parsed chat exports into memories.
 * Uses the existing MemoryService, CategoryService, TagService, and RelationshipService.
 */

import { parseChatExport, clusterMessages, type ParsedMessage } from "./chat-import-parser";
import { createMemory } from "./memory";
import { generateEmbedding } from "./embedding";
import { assignCategory } from "./categorizer";
import { extractAndAssignTags } from "./tagger";
import { findRelatedMemories, createRelationships } from "./relationship";
import { createServerSupabase } from "../supabase/server";

export interface ImportProgress {
  status: "parsing" | "filtering" | "creating" | "complete" | "error";
  totalMessages: number;
  filteredMessages: number;
  createdMemories: number;
  currentBatch: number;
  totalBatches: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  memoriesCreated: number;
  memoriesSkipped: number;
  categoriesUsed: number;
  parseResult: {
    format: string;
    totalLines: number;
    parsedMessages: number;
    skippedMessages: number;
  };
  error?: string;
}

// Minimum content length after clustering to be worth saving
const MIN_CONTENT_LENGTH = 20;
// Maximum memories per import (prevent abuse)
const MAX_MEMORIES_PER_IMPORT = 200;
// Batch size for processing
const BATCH_SIZE = 10;

/**
 * Filter clustered messages for memory-worthiness.
 * Keeps messages that are substantive enough to be valuable as memories.
 */
function filterForMemoryWorthiness(messages: ParsedMessage[]): ParsedMessage[] {
  return messages.filter(msg => {
    const content = msg.content.trim();
    // Must be long enough
    if (content.length < MIN_CONTENT_LENGTH) return false;
    // Must have at least 3 words
    if (content.split(/\s+/).length < 3) return false;
    // Skip media-only messages
    if (msg.isMedia) return false;
    return true;
  });
}

/**
 * Generate a title from content.
 */
function generateTitle(content: string): string {
  // Take the first line or first 60 chars
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 57) + "...";
}

/**
 * Run the full import pipeline for a user.
 * 
 * @param userId - Clerk user ID
 * @param fileContent - Raw text content of the chat export file
 * @param fileName - Original file name for logging
 * @param onProgress - Optional callback for progress updates
 */
export async function importChatHistory(
  userId: string,
  fileContent: string,
  fileName: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const supabase = createServerSupabase();
  
  const updateProgress = (p: Partial<ImportProgress>) => {
    onProgress?.({ 
      status: "parsing", 
      totalMessages: 0, 
      filteredMessages: 0,
      createdMemories: 0, 
      currentBatch: 0, 
      totalBatches: 0, 
      ...p 
    } as ImportProgress);
  };
  
  // Step 1: Parse
  updateProgress({ status: "parsing" });
  const parseResult = parseChatExport(fileContent);
  
  if (parseResult.parsedCount === 0) {
    return {
      success: false,
      memoriesCreated: 0,
      memoriesSkipped: 0,
      categoriesUsed: 0,
      parseResult: {
        format: parseResult.format,
        totalLines: parseResult.totalLines,
        parsedMessages: 0,
        skippedMessages: parseResult.skippedCount,
      },
      error: "Could not parse any messages from the file. Ensure it's a WhatsApp or Telegram chat export.",
    };
  }
  
  // Step 2: Cluster consecutive messages
  const clustered = clusterMessages(parseResult.messages);
  
  // Step 3: Filter for memory-worthiness
  updateProgress({ status: "filtering", totalMessages: clustered.length });
  let filtered = filterForMemoryWorthiness(clustered);
  
  // Cap at max
  if (filtered.length > MAX_MEMORIES_PER_IMPORT) {
    filtered = filtered.slice(0, MAX_MEMORIES_PER_IMPORT);
  }
  
  const totalBatches = Math.ceil(filtered.length / BATCH_SIZE);
  updateProgress({ 
    status: "creating", 
    totalMessages: clustered.length,
    filteredMessages: filtered.length,
    totalBatches,
  });
  
  // Create import history record
  const { data: importRecord, error: importError } = await supabase
    .from("import_history")
    .insert({
      user_id: userId,
      file_name: fileName,
      file_size_bytes: fileContent.length,
      format: parseResult.format,
      total_messages_parsed: parseResult.parsedCount,
      status: "processing",
    })
    .select()
    .single();
  
  if (importError) {
    console.error("[bulk-import] Failed to create import record:", importError.message);
  }
  
  const importId = importRecord?.id;
  
  // Step 4: Create memories in batches
  let memoriesCreated = 0;
  let memoriesSkipped = 0;
  const categoriesUsed = new Set<string>();
  
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    updateProgress({ 
      status: "creating", 
      createdMemories: memoriesCreated,
      currentBatch: batchNum,
    });
    
    for (const msg of batch) {
      try {
        // Create memory with title
        const title = generateTitle(msg.content);
        const memory = await createMemory({
          userId,
          title,
          content: msg.content,
          sourcePlatform: "web", // Imported via web dashboard
          occurredAt: msg.timestamp?.toISOString() ?? null,
        });
        
        // Link to import
        if (importId) {
          await supabase
            .from("memories")
            .update({ import_id: importId })
            .eq("id", memory.id);
        }
        
        // Categorize
        const category = await assignCategory(userId, memory.content);
        if (category) {
          categoriesUsed.add(category.name);
          await supabase
            .from("memories")
            .update({ category_id: category.id })
            .eq("id", memory.id);
        }
        
        // Tag
        const tags = await extractAndAssignTags(userId, memory.content);
        if (tags.length > 0) {
          await supabase.from("memory_tags").insert(
            tags.map((t) => ({ memory_id: memory.id, tag_id: t.id }))
          );
        }
        
        // Find and create relationships
        try {
          const embedding = await generateEmbedding(memory.content);
          const related = await findRelatedMemories(userId, memory.id, embedding);
          if (related.length > 0) {
            await createRelationships(memory.id, related);
          }
        } catch (relError) {
          // Non-fatal - memory was still saved
          console.error(`[bulk-import] Failed to create relationships for memory ${memory.id}:`, relError);
        }
        
        memoriesCreated++;
      } catch (err) {
        console.error(`[bulk-import] Failed to create memory for user ${userId}:`, err);
        memoriesSkipped++;
      }
    }
  }
  
  // Update import record
  if (importId) {
    await supabase
      .from("import_history")
      .update({
        memories_created: memoriesCreated,
        memories_skipped: memoriesSkipped,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);
  }
  
  updateProgress({
    status: "complete",
    createdMemories: memoriesCreated,
  });
  
  return {
    success: true,
    memoriesCreated,
    memoriesSkipped,
    categoriesUsed: categoriesUsed.size,
    parseResult: {
      format: parseResult.format,
      totalLines: parseResult.totalLines,
      parsedMessages: parseResult.parsedCount,
      skippedMessages: parseResult.skippedCount,
    },
  };
}
