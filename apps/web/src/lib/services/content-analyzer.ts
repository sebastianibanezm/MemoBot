/**
 * Content Analyzer Service
 * Extracts text and descriptions from various file types using AI and parsing libraries.
 * - Images: OpenAI GPT-4 Vision
 * - PDFs: pdf-parse library
 * - Text files: Direct reading
 * - Other: Marked as unsupported
 */

import OpenAI from "openai";

// Supported MIME types for analysis
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const PDF_TYPES = ["application/pdf"];
const TEXT_TYPES = ["text/plain", "text/markdown"];
const DOCX_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

// Vision model for image analysis
const VISION_MODEL = "gpt-4o-mini";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export type ExtractionStatus = "completed" | "failed" | "unsupported";

export interface AnalysisResult {
  content: string | null;
  status: ExtractionStatus;
  error?: string;
}

/**
 * Analyze file content and extract text/description.
 * Routes to appropriate analyzer based on MIME type.
 */
export async function analyzeFileContent(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<AnalysisResult> {
  const normalizedMime = mimeType.toLowerCase();

  try {
    if (IMAGE_TYPES.includes(normalizedMime)) {
      return await analyzeImage(buffer, normalizedMime);
    }

    if (PDF_TYPES.includes(normalizedMime)) {
      return await analyzePdf(buffer, fileName);
    }

    if (TEXT_TYPES.includes(normalizedMime)) {
      return analyzeTextFile(buffer);
    }

    if (DOCX_TYPES.includes(normalizedMime)) {
      return await analyzeDocx(buffer, fileName);
    }

    // Unsupported file type - still store but can't extract content
    return {
      content: null,
      status: "unsupported",
      error: `Unsupported file type: ${mimeType}`,
    };
  } catch (error) {
    console.error(
      "[content-analyzer] Analysis failed:",
      error instanceof Error ? error.message : error
    );
    return {
      content: null,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown analysis error",
    };
  }
}

/**
 * Analyze image using GPT-4 Vision to extract description.
 */
async function analyzeImage(
  buffer: Buffer,
  mimeType: string
): Promise<AnalysisResult> {
  const openai = getOpenAIClient();

  // Convert buffer to base64 data URL
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  console.log(`[content-analyzer] Analyzing image (${buffer.length} bytes)`);

  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Describe this image concisely for a personal memory/note system. Focus on:
1. What the image shows (objects, people, places, events)
2. Any visible text or writing
3. Context clues (time of day, location, occasion)

Keep the description under 200 words and factual. If there's text in the image, include it verbatim.`,
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
              detail: "low", // Use low detail to reduce tokens/cost
            },
          },
        ],
      },
    ],
  });

  const description = response.choices[0]?.message?.content?.trim();

  if (!description) {
    return {
      content: null,
      status: "failed",
      error: "Empty response from vision model",
    };
  }

  console.log(
    `[content-analyzer] Image analyzed: "${description.slice(0, 100)}..."`
  );

  return {
    content: description,
    status: "completed",
  };
}

/**
 * Extract text from PDF using pdf-parse library.
 */
async function analyzePdf(
  buffer: Buffer,
  fileName: string
): Promise<AnalysisResult> {
  console.log(
    `[content-analyzer] Parsing PDF: ${fileName} (${buffer.length} bytes)`
  );

  try {
    // Dynamic import to avoid bundling issues
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);

    const text = data.text?.trim();

    if (!text) {
      return {
        content: null,
        status: "failed",
        error: "No text content found in PDF",
      };
    }

    // Truncate very long PDFs to avoid storage/processing issues
    const maxLength = 10000;
    const truncatedText =
      text.length > maxLength
        ? text.slice(0, maxLength) + "\n\n[Content truncated...]"
        : text;

    console.log(
      `[content-analyzer] PDF parsed: ${data.numpages} pages, ${text.length} chars`
    );

    return {
      content: truncatedText,
      status: "completed",
    };
  } catch (error) {
    // pdf-parse can fail on encrypted or malformed PDFs
    console.error(
      "[content-analyzer] PDF parsing failed:",
      error instanceof Error ? error.message : error
    );
    return {
      content: null,
      status: "failed",
      error: `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Read text directly from plain text or markdown files.
 */
function analyzeTextFile(buffer: Buffer): AnalysisResult {
  const text = buffer.toString("utf-8").trim();

  if (!text) {
    return {
      content: null,
      status: "failed",
      error: "Empty text file",
    };
  }

  // Truncate very long text files
  const maxLength = 10000;
  const truncatedText =
    text.length > maxLength
      ? text.slice(0, maxLength) + "\n\n[Content truncated...]"
      : text;

  console.log(`[content-analyzer] Text file read: ${text.length} chars`);

  return {
    content: truncatedText,
    status: "completed",
  };
}

/**
 * Extract text from .doc/.docx using mammoth.
 */
async function analyzeDocx(
  buffer: Buffer,
  fileName: string
): Promise<AnalysisResult> {
  console.log(
    `[content-analyzer] Parsing DOCX: ${fileName} (${buffer.length} bytes)`
  );

  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });

    const text = result.value?.trim();

    if (!text) {
      return {
        content: null,
        status: "failed",
        error: "No text content found in document",
      };
    }

    // Truncate very long documents
    const maxLength = 10000;
    const truncatedText =
      text.length > maxLength
        ? text.slice(0, maxLength) + "\n\n[Content truncated...]"
        : text;

    console.log(
      `[content-analyzer] DOCX parsed: ${text.length} chars`
    );

    return {
      content: truncatedText,
      status: "completed",
    };
  } catch (error) {
    console.error(
      "[content-analyzer] DOCX parsing failed:",
      error instanceof Error ? error.message : error
    );
    return {
      content: null,
      status: "failed",
      error: `Failed to parse document: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if a MIME type is supported for content extraction.
 */
export function isAnalyzableType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return (
    IMAGE_TYPES.includes(normalized) ||
    PDF_TYPES.includes(normalized) ||
    TEXT_TYPES.includes(normalized) ||
    DOCX_TYPES.includes(normalized)
  );
}

/**
 * Get a human-readable file type category.
 */
export function getFileTypeCategory(
  mimeType: string
): "image" | "document" | "video" | "audio" | "other" {
  const normalized = mimeType.toLowerCase();

  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  if (
    normalized.includes("pdf") ||
    normalized.includes("document") ||
    normalized.includes("text")
  ) {
    return "document";
  }

  return "other";
}
