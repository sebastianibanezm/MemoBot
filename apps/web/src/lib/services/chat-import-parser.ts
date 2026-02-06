/**
 * Chat Import Parser: Parses WhatsApp and Telegram chat exports into structured messages.
 * 
 * WhatsApp format: "MM/DD/YY, HH:MM - Sender: Message"
 * Telegram format: Varies, but typically "Sender Name (DD.MM.YYYY HH:MM:SS):\nMessage"
 */

export interface ParsedMessage {
  timestamp: Date | null;
  sender: string;
  content: string;
  isMedia: boolean;
}

export interface ParseResult {
  messages: ParsedMessage[];
  format: "whatsapp" | "telegram" | "unknown";
  totalLines: number;
  parsedCount: number;
  skippedCount: number;
}

// WhatsApp patterns - various date formats
const WA_MESSAGE_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM|am|pm)?\s*[-–]\s+([^:]+):\s+(.+)$/;
const WA_SYSTEM_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})/; // system messages without sender

// Telegram patterns
const TG_MESSAGE_RE = /^(.+?)\s*\((\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2})\):$/;

// Noise filters — skip these messages
const NOISE_PATTERNS = [
  /^<media omitted>$/i,
  /^image omitted$/i,
  /^video omitted$/i,
  /^audio omitted$/i,
  /^sticker omitted$/i,
  /^gif omitted$/i,
  /^document omitted$/i,
  /^contact card omitted$/i,
  /^location:/i,
  /^this message was deleted$/i,
  /^you deleted this message$/i,
  /^null$/i,
  /^messages and calls are end-to-end encrypted/i,
  /created group/i,
  /changed the subject/i,
  /changed this group/i,
  /added you/i,
  /left$/i,
  /joined using this group/i,
  /^\s*$/,
];

const SHORT_NOISE_PATTERNS = [
  /^(ok|okay|k|kk|lol|haha|hehe|hmm|ah|oh|yes|no|yeah|nah|sure|thanks|ty|thx|np|cool|nice|great|wow|omg|brb|gtg|ttyl|bye|hi|hey|hello|yo|sup|gn|gm|👍|👎|❤️|😂|😭|🙏|💯|🔥|✅|👌|🤷|🤦)$/i,
];

/**
 * Check if a message is noise (system messages, short reactions, media omitted, etc.)
 */
function isNoise(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 2) return true;
  if (NOISE_PATTERNS.some(p => p.test(trimmed))) return true;
  if (trimmed.split(/\s+/).length <= 2 && SHORT_NOISE_PATTERNS.some(p => p.test(trimmed))) return true;
  return false;
}

/**
 * Parse a WhatsApp date string into a Date object.
 */
function parseWhatsAppDate(date: string, time: string): Date | null {
  try {
    // Handle various date formats
    const dateStr = `${date} ${time}`;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
    
    // Try DD/MM/YYYY format
    const parts = date.split("/");
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const fullYear = year.length === 2 ? `20${year}` : year;
      return new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}`);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a WhatsApp chat export.
 */
function parseWhatsApp(lines: string[]): ParseResult {
  const messages: ParsedMessage[] = [];
  let currentMessage: ParsedMessage | null = null;
  let skipped = 0;
  
  for (const line of lines) {
    const match = WA_MESSAGE_RE.exec(line);
    if (match) {
      // Save previous message if it exists
      if (currentMessage && !isNoise(currentMessage.content)) {
        messages.push(currentMessage);
      } else if (currentMessage) {
        skipped++;
      }
      
      const [, date, time, sender, content] = match;
      currentMessage = {
        timestamp: parseWhatsAppDate(date, time),
        sender: sender.trim(),
        content: content.trim(),
        isMedia: /^<media omitted>$/i.test(content.trim()),
      };
    } else if (WA_SYSTEM_RE.test(line)) {
      // System message, skip
      skipped++;
    } else if (currentMessage) {
      // Continuation of previous message
      currentMessage.content += "\n" + line;
    }
  }
  
  // Don't forget the last message
  if (currentMessage && !isNoise(currentMessage.content)) {
    messages.push(currentMessage);
  }
  
  return {
    messages,
    format: "whatsapp",
    totalLines: lines.length,
    parsedCount: messages.length,
    skippedCount: skipped,
  };
}

/**
 * Parse a Telegram chat export (plain text format).
 */
function parseTelegram(lines: string[]): ParseResult {
  const messages: ParsedMessage[] = [];
  let currentSender = "";
  let currentTimestamp: Date | null = null;
  let currentContent = "";
  let skipped = 0;
  
  for (const line of lines) {
    const match = TG_MESSAGE_RE.exec(line);
    if (match) {
      // Save previous
      if (currentContent && !isNoise(currentContent)) {
        messages.push({
          timestamp: currentTimestamp,
          sender: currentSender,
          content: currentContent.trim(),
          isMedia: false,
        });
      } else if (currentContent) {
        skipped++;
      }
      
      currentSender = match[1].trim();
      try {
        // Parse DD.MM.YYYY HH:MM:SS format
        const dateStr = match[2];
        const [datePart, timePart] = dateStr.split(" ");
        const [day, month, year] = datePart.split(".");
        currentTimestamp = new Date(`${year}-${month}-${day}T${timePart}`);
      } catch {
        currentTimestamp = null;
      }
      currentContent = "";
    } else {
      currentContent += (currentContent ? "\n" : "") + line;
    }
  }
  
  if (currentContent && !isNoise(currentContent)) {
    messages.push({
      timestamp: currentTimestamp,
      sender: currentSender,
      content: currentContent.trim(),
      isMedia: false,
    });
  }
  
  return {
    messages,
    format: "telegram",
    totalLines: lines.length,
    parsedCount: messages.length,
    skippedCount: skipped,
  };
}

/**
 * Auto-detect format and parse a chat export file.
 */
export function parseChatExport(content: string): ParseResult {
  const lines = content.split("\n");
  
  // Detect format by checking first few lines
  const sample = lines.slice(0, 20).join("\n");
  
  if (WA_MESSAGE_RE.test(sample)) {
    return parseWhatsApp(lines);
  }
  
  if (TG_MESSAGE_RE.test(sample)) {
    return parseTelegram(lines);
  }
  
  // Fallback: try WhatsApp first (more common), then Telegram
  const waResult = parseWhatsApp(lines);
  if (waResult.parsedCount > 0) return waResult;
  
  const tgResult = parseTelegram(lines);
  if (tgResult.parsedCount > 0) return tgResult;
  
  return {
    messages: [],
    format: "unknown",
    totalLines: lines.length,
    parsedCount: 0,
    skippedCount: lines.length,
  };
}

/**
 * Group messages by sender into "thought clusters" — consecutive messages 
 * from the same sender within 5 minutes become one memory.
 */
export function clusterMessages(messages: ParsedMessage[]): ParsedMessage[] {
  if (messages.length === 0) return [];
  
  const clusters: ParsedMessage[] = [];
  let current = { ...messages[0] };
  
  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    const sameAuthor = msg.sender === current.sender;
    const timeDiff = msg.timestamp && current.timestamp
      ? Math.abs(msg.timestamp.getTime() - current.timestamp.getTime()) / 1000 / 60
      : Infinity;
    
    if (sameAuthor && timeDiff < 5) {
      // Merge into current cluster
      current.content += "\n" + msg.content;
    } else {
      clusters.push(current);
      current = { ...msg };
    }
  }
  
  clusters.push(current);
  return clusters;
}
