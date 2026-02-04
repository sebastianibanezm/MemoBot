/**
 * Embedding service using OpenAI text-embedding-3-small (512 dimensions).
 * Used for memories, categories, and tags for semantic search.
 */

import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSIONS = 512;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

/**
 * Generate a single embedding vector for the given text (512 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
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
  return embedding;
}

/**
 * Generate embeddings for multiple texts in one request (batch).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getClient();
  const trimmed = texts.map((t) => t.trim().slice(0, 8000));
  const { data } = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
    dimensions: DIMENSIONS,
  });
  const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => {
    const e = d.embedding;
    if (!e || e.length !== DIMENSIONS) throw new Error("Invalid embedding");
    return e;
  });
}
