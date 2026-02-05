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
import * as React from "react";

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

interface BaseProps {
  /** Optional logo URL or base64 data URI. Defaults to baseUrl/images/MemoBot_logo.png */
  logoSrc?: string;
}

interface WeeklyDigestProps extends BaseProps {
  type: "weekly_digest";
  userName: string;
  weekStartDate: string;
  weekEndDate: string;
  memoriesCount: number;
  narrative: string; // AI-generated engaging narrative of the week's memories
  topCategories?: string[];
  ctaUrl?: string;
}

interface ReminderProps extends BaseProps {
  type: "reminder";
  userName: string;
  memoryTitle: string;
  memoryPreview: string;
  memoryDate?: string;
  reminderMessage?: string;
  ctaUrl?: string;
}

type MemoNotificationProps = WeeklyDigestProps | ReminderProps;

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://memobot.app";

export const MemoNotification = (props: MemoNotificationProps) => {
  const { userName, ctaUrl = `${baseUrl}/dashboard`, logoSrc } = props;
  const logoUrl = logoSrc || `${baseUrl}/images/MemoBot_logo.png`;

  const renderWeeklyDigest = (digestProps: WeeklyDigestProps) => {
    const {
      weekStartDate,
      weekEndDate,
      memoriesCount,
      narrative,
      topCategories = [],
    } = digestProps;

    return (
      <>
        <Text style={paragraph}>
          <span style={{ color: colors.accent }}>&gt;</span> Your week in
          memories: {weekStartDate} — {weekEndDate}
        </Text>

        {/* Stats Banner */}
        <Section style={statsCard}>
          <Text style={statsNumber}>{memoriesCount}</Text>
          <Text style={statsLabel}>
            {memoriesCount === 1 ? "MEMORY CAPTURED" : "MEMORIES CAPTURED"}
          </Text>
        </Section>

        {/* Narrative Section */}
        <Section style={narrativeCard}>
          <Text style={narrativeLabel}>
            <span style={{ color: colors.accent }}>//</span> YOUR WEEK
          </Text>
          <Text style={narrativeText}>{narrative}</Text>
        </Section>

        {/* Categories */}
        {topCategories.length > 0 && (
          <Section style={{ marginTop: "24px" }}>
            <Text style={categoriesLabel}>CATEGORIES TOUCHED:</Text>
            <Section style={categoriesContainer}>
              {topCategories.map((cat) => (
                <Text key={cat} style={categoryTag}>
                  {cat}
                </Text>
              ))}
            </Section>
          </Section>
        )}
      </>
    );
  };

  const renderReminder = (reminderProps: ReminderProps) => {
    const { memoryTitle, memoryPreview, memoryDate, reminderMessage } =
      reminderProps;

    return (
      <>
        <Text style={paragraph}>
          <span style={{ color: colors.accent }}>&gt;</span>{" "}
          {reminderMessage || "You asked to be reminded about this memory:"}
        </Text>

        <Section style={memoryCard}>
          <Text style={memoryTitleStyle}>{memoryTitle}</Text>
          <Text style={memoryPreviewStyle}>{memoryPreview}</Text>
          {memoryDate && (
            <Text style={memoryDateStyle}>
              <span style={{ color: colors.accent }}>//</span> {memoryDate}
            </Text>
          )}
        </Section>
      </>
    );
  };

  const getContent = () => {
    if (props.type === "weekly_digest") {
      return {
        previewText: `Your MemoBot weekly digest: ${props.memoriesCount} memories captured`,
        heading: "WEEKLY DIGEST",
        subheading: "// VAULT.STATUS.REPORT",
        body: renderWeeklyDigest(props),
        ctaText: "VIEW ALL MEMORIES",
      };
    } else {
      return {
        previewText: `Reminder: ${props.memoryTitle}`,
        heading: "MEMORY REMINDER",
        subheading: "// SCHEDULED.NOTIFICATION",
        body: renderReminder(props),
        ctaText: "VIEW MEMORY",
      };
    }
  };

  const content = getContent();

  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Bebas+Neue&display=swap');
          `}
        </style>
      </Head>
      <Preview>{content.previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <table>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle", paddingRight: "12px" }}>
                    <Img
                      src={logoUrl}
                      width="40"
                      height="40"
                      alt="MemoBot"
                      style={logo}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <Text style={brandName}>MEMOBOT</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Hr style={divider} />

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={heading}>{content.heading}</Heading>
            <Text style={subheading}>{content.subheading}</Text>

            <Text style={greeting}>Hello, {userName}</Text>

            {content.body}

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={ctaUrl}>
                {content.ctaText}
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerStatus}>
              <span style={{ color: colors.accent }}>//</span> SYS.STATUS:
              OPERATIONAL
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/dashboard`} style={footerLink}>
                DASHBOARD
              </Link>
              {" • "}
              <Link href={`${baseUrl}/settings`} style={footerLink}>
                SETTINGS
              </Link>
              {" • "}
              <Link href={`${baseUrl}/unsubscribe`} style={footerLink}>
                UNSUBSCRIBE
              </Link>
            </Text>
            <Text style={copyright}>
              MemoBot © {new Date().getFullYear()} — Your AI Memory Assistant
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default MemoNotification;

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

const heading: React.CSSProperties = {
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

// Weekly Digest Styles
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

const categoriesContainer: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
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

// Reminder Styles
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

// Button
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

// Footer
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
