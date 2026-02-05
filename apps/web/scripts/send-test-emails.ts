import { Resend } from "resend";
import * as React from "react";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const vars: Record<string, string> = {};
    envContent.split("\n").forEach((line) => {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed) return;
      const eqIndex = line.indexOf("=");
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1);
        // Remove inline comments (but be careful with values that might contain #)
        // Only strip if there's whitespace before the #
        const commentMatch = value.match(/\s+#/);
        if (commentMatch) {
          value = value.substring(0, commentMatch.index);
        }
        vars[key] = value.trim();
      }
    });
    return vars;
  } catch (e) {
    console.error("Error loading env:", e);
    return {};
  }
}

const envVars = loadEnv();

// Inline the email template to avoid module resolution issues
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// MemoBot Brand Colors
const colors = {
  background: "#000000",
  backgroundAlt: "#0a0a0a",
  foreground: "#e8e4db",
  foregroundMuted: "#c4c0b8",
  accent: "#00b34a",
  accentDark: "#009940",
  muted: "#9a958c",
  mutedLight: "#7a756c",
  cardBorder: "rgba(0, 179, 74, 0.3)",
};

const baseUrl = "https://memobot.app";

// Load logo as base64 for embedding in emails
function getLogoBase64(): string {
  const logoPath = path.resolve(process.cwd(), "public/images/MemoBot_logo.png");
  const logoBuffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${logoBuffer.toString("base64")}`;
}

// Styles
const main: React.CSSProperties = {
  backgroundColor: colors.background,
  fontFamily:
    "'IBM Plex Mono', 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "600px",
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "24px",
};

const logo: React.CSSProperties = {
  borderRadius: "4px",
  display: "block",
};

const brandName: React.CSSProperties = {
  fontSize: "24px",
  fontFamily: "'Bebas Neue', 'Impact', sans-serif",
  letterSpacing: "0.2em",
  color: colors.foreground,
  margin: 0,
};

const divider: React.CSSProperties = {
  borderTop: `1px solid ${colors.cardBorder}`,
  borderBottom: "none",
  margin: "24px 0",
};

const contentSection: React.CSSProperties = {
  padding: "0 10px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "28px",
  fontFamily: "'Bebas Neue', 'Impact', sans-serif",
  letterSpacing: "0.15em",
  color: colors.accent,
  margin: "0 0 8px 0",
  textAlign: "center" as const,
};

const subheading: React.CSSProperties = {
  fontSize: "12px",
  color: colors.muted,
  letterSpacing: "0.1em",
  margin: "0 0 24px 0",
  textAlign: "center" as const,
  textTransform: "uppercase" as const,
};

const greeting: React.CSSProperties = {
  fontSize: "14px",
  color: colors.foreground,
  margin: "0 0 20px 0",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: colors.foregroundMuted,
  margin: "0 0 16px 0",
};

const statsCard: React.CSSProperties = {
  backgroundColor: colors.backgroundAlt,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: "4px",
  padding: "24px",
  margin: "16px 0",
  textAlign: "center" as const,
};

const statsNumber: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: 600,
  color: colors.accent,
  margin: "0 0 4px 0",
  fontFamily: "'Bebas Neue', 'Impact', sans-serif",
  letterSpacing: "0.05em",
};

const statsLabel: React.CSSProperties = {
  fontSize: "11px",
  color: colors.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.15em",
  margin: 0,
};

const narrativeCard: React.CSSProperties = {
  backgroundColor: colors.backgroundAlt,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: "4px",
  padding: "24px",
  margin: "20px 0",
};

const narrativeLabel: React.CSSProperties = {
  fontSize: "11px",
  color: colors.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: "0 0 16px 0",
};

const narrativeText: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.8",
  color: colors.foreground,
  margin: 0,
  whiteSpace: "pre-wrap" as const,
};

const categoriesLabel: React.CSSProperties = {
  fontSize: "11px",
  color: colors.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: "0 0 12px 0",
};

const categoryTag: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  color: colors.accentDark,
  backgroundColor: "rgba(0, 179, 74, 0.1)",
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: "2px",
  padding: "4px 10px",
  margin: "0 8px 8px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const memoryCard: React.CSSProperties = {
  backgroundColor: colors.backgroundAlt,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: "4px",
  padding: "20px",
  margin: "16px 0",
};

const memoryTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: colors.foreground,
  margin: "0 0 12px 0",
};

const memoryPreviewStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: colors.foregroundMuted,
  margin: "0 0 16px 0",
};

const memoryDateStyle: React.CSSProperties = {
  fontSize: "11px",
  color: colors.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: 0,
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "transparent",
  border: `1px solid ${colors.accent}`,
  borderRadius: "4px",
  color: colors.accent,
  fontSize: "14px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  padding: "14px 28px",
  textDecoration: "none",
  textTransform: "uppercase" as const,
  fontFamily:
    "'IBM Plex Mono', 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
};

const footerStatus: React.CSSProperties = {
  fontSize: "11px",
  color: colors.mutedLight,
  letterSpacing: "0.1em",
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
};

const footerLinks: React.CSSProperties = {
  fontSize: "11px",
  margin: "0 0 16px 0",
};

const footerLink: React.CSSProperties = {
  color: colors.muted,
  textDecoration: "none",
  letterSpacing: "0.05em",
};

const copyright: React.CSSProperties = {
  fontSize: "11px",
  color: colors.mutedLight,
  margin: 0,
};

// Weekly Digest Email
function WeeklyDigestEmail({
  userName,
  weekStartDate,
  weekEndDate,
  memoriesCount,
  narrative,
  topCategories,
  ctaUrl,
  logoSrc,
}: {
  userName: string;
  weekStartDate: string;
  weekEndDate: string;
  memoriesCount: number;
  narrative: string;
  topCategories: string[];
  ctaUrl: string;
  logoSrc: string;
}) {
  return React.createElement(
    Html,
    null,
    React.createElement(
      Head,
      null,
      React.createElement("style", null, `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Bebas+Neue&display=swap');
      `)
    ),
    React.createElement(Preview, null, `Your MemoBot weekly digest: ${memoriesCount} memories captured`),
    React.createElement(
      Body,
      { style: main },
      React.createElement(
        Container,
        { style: container },
        // Header
        React.createElement(
          Section,
          { style: header },
          React.createElement(
            "table",
            null,
            React.createElement(
              "tbody",
              null,
              React.createElement(
                "tr",
                null,
                React.createElement(
                  "td",
                  { style: { verticalAlign: "middle", paddingRight: "12px" } },
                  React.createElement(Img, {
                    src: logoSrc,
                    width: "40",
                    height: "40",
                    alt: "MemoBot",
                    style: logo,
                  })
                ),
                React.createElement(
                  "td",
                  { style: { verticalAlign: "middle" } },
                  React.createElement(Text, { style: brandName }, "MEMOBOT")
                )
              )
            )
          )
        ),
        React.createElement(Hr, { style: divider }),
        // Content
        React.createElement(
          Section,
          { style: contentSection },
          React.createElement(Heading, { style: headingStyle }, "WEEKLY DIGEST"),
          React.createElement(Text, { style: subheading }, "// VAULT.STATUS.REPORT"),
          React.createElement(Text, { style: greeting }, `Hello, ${userName}`),
          React.createElement(
            Text,
            { style: paragraph },
            React.createElement("span", { style: { color: colors.accent } }, ">"),
            ` Your week in memories: ${weekStartDate} — ${weekEndDate}`
          ),
          // Stats
          React.createElement(
            Section,
            { style: statsCard },
            React.createElement(Text, { style: statsNumber }, memoriesCount),
            React.createElement(Text, { style: statsLabel }, memoriesCount === 1 ? "MEMORY CAPTURED" : "MEMORIES CAPTURED")
          ),
          // Narrative
          React.createElement(
            Section,
            { style: narrativeCard },
            React.createElement(
              Text,
              { style: narrativeLabel },
              React.createElement("span", { style: { color: colors.accent } }, "//"),
              " YOUR WEEK"
            ),
            React.createElement(Text, { style: narrativeText }, narrative)
          ),
          // Categories
          topCategories.length > 0 && React.createElement(
            Section,
            { style: { marginTop: "24px" } },
            React.createElement(Text, { style: categoriesLabel }, "CATEGORIES TOUCHED:"),
            React.createElement(
              Section,
              null,
              topCategories.map((cat) =>
                React.createElement(Text, { key: cat, style: categoryTag }, cat)
              )
            )
          ),
          // CTA
          React.createElement(
            Section,
            { style: buttonContainer },
            React.createElement(Button, { style: button, href: ctaUrl }, "VIEW ALL MEMORIES")
          )
        ),
        React.createElement(Hr, { style: divider }),
        // Footer
        React.createElement(
          Section,
          { style: footer },
          React.createElement(
            Text,
            { style: footerStatus },
            React.createElement("span", { style: { color: colors.accent } }, "//"),
            " SYS.STATUS: OPERATIONAL"
          ),
          React.createElement(
            Text,
            { style: footerLinks },
            React.createElement(Link, { href: `${baseUrl}/dashboard`, style: footerLink }, "DASHBOARD"),
            " • ",
            React.createElement(Link, { href: `${baseUrl}/settings`, style: footerLink }, "SETTINGS"),
            " • ",
            React.createElement(Link, { href: `${baseUrl}/unsubscribe`, style: footerLink }, "UNSUBSCRIBE")
          ),
          React.createElement(Text, { style: copyright }, `MemoBot © ${new Date().getFullYear()} — Your AI Memory Assistant`)
        )
      )
    )
  );
}

// Reminder Email
function ReminderEmail({
  userName,
  memoryTitle,
  memoryPreview,
  memoryDate,
  reminderMessage,
  ctaUrl,
  logoSrc,
}: {
  userName: string;
  memoryTitle: string;
  memoryPreview: string;
  memoryDate?: string;
  reminderMessage: string;
  ctaUrl: string;
  logoSrc: string;
}) {
  return React.createElement(
    Html,
    null,
    React.createElement(
      Head,
      null,
      React.createElement("style", null, `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Bebas+Neue&display=swap');
      `)
    ),
    React.createElement(Preview, null, `Reminder: ${memoryTitle}`),
    React.createElement(
      Body,
      { style: main },
      React.createElement(
        Container,
        { style: container },
        // Header
        React.createElement(
          Section,
          { style: header },
          React.createElement(
            "table",
            null,
            React.createElement(
              "tbody",
              null,
              React.createElement(
                "tr",
                null,
                React.createElement(
                  "td",
                  { style: { verticalAlign: "middle", paddingRight: "12px" } },
                  React.createElement(Img, {
                    src: logoSrc,
                    width: "40",
                    height: "40",
                    alt: "MemoBot",
                    style: logo,
                  })
                ),
                React.createElement(
                  "td",
                  { style: { verticalAlign: "middle" } },
                  React.createElement(Text, { style: brandName }, "MEMOBOT")
                )
              )
            )
          )
        ),
        React.createElement(Hr, { style: divider }),
        // Content
        React.createElement(
          Section,
          { style: contentSection },
          React.createElement(Heading, { style: headingStyle }, "MEMORY REMINDER"),
          React.createElement(Text, { style: subheading }, "// SCHEDULED.NOTIFICATION"),
          React.createElement(Text, { style: greeting }, `Hello, ${userName}`),
          React.createElement(
            Text,
            { style: paragraph },
            React.createElement("span", { style: { color: colors.accent } }, ">"),
            ` ${reminderMessage}`
          ),
          // Memory Card
          React.createElement(
            Section,
            { style: memoryCard },
            React.createElement(Text, { style: memoryTitleStyle }, memoryTitle),
            React.createElement(Text, { style: memoryPreviewStyle }, memoryPreview),
            memoryDate && React.createElement(
              Text,
              { style: memoryDateStyle },
              React.createElement("span", { style: { color: colors.accent } }, "//"),
              ` ${memoryDate}`
            )
          ),
          // CTA
          React.createElement(
            Section,
            { style: buttonContainer },
            React.createElement(Button, { style: button, href: ctaUrl }, "VIEW MEMORY")
          )
        ),
        React.createElement(Hr, { style: divider }),
        // Footer
        React.createElement(
          Section,
          { style: footer },
          React.createElement(
            Text,
            { style: footerStatus },
            React.createElement("span", { style: { color: colors.accent } }, "//"),
            " SYS.STATUS: OPERATIONAL"
          ),
          React.createElement(
            Text,
            { style: footerLinks },
            React.createElement(Link, { href: `${baseUrl}/dashboard`, style: footerLink }, "DASHBOARD"),
            " • ",
            React.createElement(Link, { href: `${baseUrl}/settings`, style: footerLink }, "SETTINGS"),
            " • ",
            React.createElement(Link, { href: `${baseUrl}/unsubscribe`, style: footerLink }, "UNSUBSCRIBE")
          ),
          React.createElement(Text, { style: copyright }, `MemoBot © ${new Date().getFullYear()} — Your AI Memory Assistant`)
        )
      )
    )
  );
}

async function sendTestEmails() {
  const targetEmail = process.argv[2] || "sebastianibanezm@gmail.com";
  
  // Read the API key directly from the file
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const resendMatch = envContent.match(/RESEND_API_KEY=([^\s#]+)/);
  const apiKey = resendMatch ? resendMatch[1] : null;
  
  if (!apiKey) {
    console.error("RESEND_API_KEY not found in .env.local");
    process.exit(1);
  }

  console.log("Sending test emails to:", targetEmail);

  // Load the logo as base64
  const logoBase64 = getLogoBase64();
  console.log("Logo loaded (base64 length):", logoBase64.length);

  const resend = new Resend(apiKey);

  // Send Weekly Digest
  console.log("\n1. Sending Weekly Digest email...");
  try {
    const { data: digestData, error: digestError } = await resend.emails.send({
      from: "MemoBot <onboarding@resend.dev>",
      to: [targetEmail],
      subject: "Your Week in Memories - MemoBot Digest",
      react: WeeklyDigestEmail({
        userName: "Sebastian",
        weekStartDate: "Jan 27",
        weekEndDate: "Feb 2",
        memoriesCount: 8,
        narrative: `You kicked off the week with a reflection on your morning routine—how the quiet before sunrise has become essential. Tuesday brought a burst of creativity: three separate ideas for the product roadmap, each building on conversations from last month's strategy session.

Mid-week, you captured a memory about that call with your brother. He mentioned the family gathering in March, and you noted wanting to bring something meaningful as a gift.

Thursday and Friday were dense with work memories. The API integration finally clicked after wrestling with authentication flows. You also documented the decision to prioritize mobile-first for the next sprint.

The week closed on a personal note: dinner at the new Thai place on Market Street. The green curry reminded you of Bangkok, and you wondered about planning a return trip.`,
        topCategories: ["Work", "Personal", "Ideas", "Family"],
        ctaUrl: "https://memobot.app/dashboard",
        logoSrc: logoBase64,
      }),
    });

    if (digestError) {
      console.error("   ✗ Weekly Digest failed:", digestError.message);
    } else {
      console.log("   ✓ Weekly Digest sent! ID:", digestData?.id);
    }
  } catch (e) {
    console.error("   ✗ Weekly Digest error:", e);
  }

  // Send Reminder
  console.log("\n2. Sending Reminder email...");
  try {
    const { data: reminderData, error: reminderError } = await resend.emails.send({
      from: "MemoBot <onboarding@resend.dev>",
      to: [targetEmail],
      subject: "Reminder: Dad's 70th Birthday Plans",
      react: ReminderEmail({
        userName: "Sebastian",
        memoryTitle: "Dad's 70th Birthday Plans",
        memoryPreview:
          "Need to coordinate with Maria about the surprise party. Venue booked for March 15th at the vineyard. Guest list finalized at 45 people. Still need to confirm the caterer and arrange transportation for grandma.",
        memoryDate: "Jan 28, 2026",
        reminderMessage: "You asked to be reminded about this 2 weeks before the event:",
        ctaUrl: "https://memobot.app/memory/test-memory-id",
        logoSrc: logoBase64,
      }),
    });

    if (reminderError) {
      console.error("   ✗ Reminder failed:", reminderError.message);
    } else {
      console.log("   ✓ Reminder sent! ID:", reminderData?.id);
    }
  } catch (e) {
    console.error("   ✗ Reminder error:", e);
  }

  console.log("\n✓ Done!");
}

sendTestEmails();
