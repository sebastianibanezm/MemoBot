/**
 * Embedding service using OpenAI text-embedding-3-small (512 dimensions).
 * Used for memories, categories, and tags for semantic search.
 * Includes LRU caching for repeated queries.
 */

import OpenAI from "openai";
import { LRUCache } from "lru-cache";

const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSIONS = 512;

// Singleton OpenAI client
let client: OpenAI | null = null;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

// LRU cache for embeddings: max 500 entries, 1 hour TTL
const embeddingCache = new LRUCache<string, number[]>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Normalize text for cache key: lowercase, trim, collapse whitespace
 */
function normalizeForCache(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Generate a single embedding vector for the given text (512 dimensions).
 * Results are cached for 1 hour.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = normalizeForCache(text);

  // Check cache first
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Generate new embedding
  const openai = getClient();
  const input = text.trim().slice(0, 8000); // model limit
  const { data } = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: input || " ",
    dimensions: DIMENSIONS,
  });
  const embedding = data[0]?.embedding;
  if (!embedding || embedding.length !== DIMENSIONS) {
    throw new Error("Invalid embedding response");
  }

  // Store in cache
  embeddingCache.set(cacheKey, embedding);

  return embedding;
}

/**
 * Generate embeddings for multiple texts in one request (batch).
 * Only calls API for uncached texts.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  // Check cache for each text
  for (let i = 0; i < texts.length; i++) {
    const cacheKey = normalizeForCache(texts[i]);
    const cached = embeddingCache.get(cacheKey);

    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  // Generate embeddings only for uncached texts
  if (uncachedTexts.length > 0) {
    const openai = getClient();
    const trimmed = uncachedTexts.map((t) => t.trim().slice(0, 8000));
    const { data } = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: trimmed,
      dimensions: DIMENSIONS,
    });

    const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    // Store results and update cache
    for (let i = 0; i < uncachedIndices.length; i++) {
      const embedding = sorted[i].embedding;
      if (!embedding || embedding.length !== DIMENSIONS) {
        throw new Error("Invalid embedding");
      }
      const originalIndex = uncachedIndices[i];
      const cacheKey = normalizeForCache(texts[originalIndex]);

      results[originalIndex] = embedding;
      embeddingCache.set(cacheKey, embedding);
    }
  }

  return results as number[][];
}

/**
 * Clear the embedding cache (useful for testing).
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache statistics (useful for monitoring).
 */
export function getEmbeddingCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size,
    maxSize: 500,
  };
}
