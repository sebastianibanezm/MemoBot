import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Privacy Policy — MemoBot",
  description: "MemoBot Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--background-alt)] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image
              src="/images/MemoBot_logo.png"
              alt="MemoBot"
              width={32}
              height={32}
              className="rounded"
            />
            <span
              className="text-lg font-display tracking-widest text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
            >
              MEMOBOT
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Sign In
            </Link>
            <Link href="/sign-up" className="btn-accent text-sm">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Title */}
        <div className="mb-12">
          <h1
            className="text-4xl md:text-5xl font-display tracking-widest mb-4"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            PRIVACY POLICY
          </h1>
          <p className="text-[var(--muted)] text-sm">
            Effective date: February 6, 2026
          </p>
          <p className="text-[var(--muted)] text-sm mt-1">
            Contact:{" "}
            <a href="mailto:privacy@memo-bot.com" className="link-accent">
              privacy@memo-bot.com
            </a>
          </p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-10">
          {/* 1 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              1 &mdash; Who we are
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              MemoBot (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a WhatsApp-based assistant
              service (the &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use,
              and share information when you use MemoBot.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              2 &mdash; Information we collect
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed mb-4">
              When you use MemoBot via WhatsApp, we may collect and process:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed">
                <span className="text-[var(--accent)] mt-0.5">+</span>
                <span>
                  <strong className="text-[var(--foreground)]">Account and identifiers:</strong> your
                  phone number and WhatsApp profile information (such as profile name), as made
                  available by WhatsApp.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed">
                <span className="text-[var(--accent)] mt-0.5">+</span>
                <span>
                  <strong className="text-[var(--foreground)]">Message content:</strong> messages you
                  send to MemoBot and the messages MemoBot sends back.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed">
                <span className="text-[var(--accent)] mt-0.5">+</span>
                <span>
                  <strong className="text-[var(--foreground)]">Metadata and logs:</strong> timestamps,
                  delivery status, and technical logs (e.g., error logs, security/audit logs, and
                  basic connection information).
                </span>
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              3 &mdash; How we use information
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed mb-4">
              We use the information above to:
            </p>
            <ul className="space-y-2">
              {[
                "Provide, operate, and maintain the Service (including generating responses).",
                "Store and display your conversation history inside MemoBot.",
                "Troubleshoot issues, monitor performance, and improve reliability.",
                "Protect the Service against fraud, abuse, and security incidents.",
                "Comply with legal obligations.",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed"
                >
                  <span className="text-[var(--accent)] mt-0.5">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              4 &mdash; Conversation storage and privacy
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              MemoBot stores conversation history to provide the Service. Conversations are owned by
              you, the user, and are completely private. They are accessible only to the user
              associated with that WhatsApp number, except in limited cases described below (e.g.,
              support requests or legal/security needs).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              5 &mdash; Sharing and third parties
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed mb-4">
              We do not sell your personal information. We share information only as needed to operate
              the Service:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed">
                <span className="text-[var(--accent)] mt-0.5">+</span>
                <span>
                  <strong className="text-[var(--foreground)]">WhatsApp / Meta:</strong> to send and
                  receive messages through the WhatsApp Business Platform.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed">
                <span className="text-[var(--accent)] mt-0.5">+</span>
                <span>
                  <strong className="text-[var(--foreground)]">OpenAI (LLM processing):</strong>{" "}
                  message content may be sent to OpenAI&rsquo;s APIs to generate responses.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[var(--foreground-muted)] leading-relaxed">
                <span className="text-[var(--accent)] mt-0.5">+</span>
                <span>
                  <strong className="text-[var(--foreground)]">Service providers:</strong>{" "}
                  infrastructure providers (hosting, databases, logging/monitoring) that process data
                  on our behalf under appropriate contractual protections.
                </span>
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              6 &mdash; Data retention
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              We retain conversation content and related data for as long as your account uses the
              Service. After account deletion or inactivity, data may be retained for up to 90 days
              unless a longer period is required for legal, security, or dispute-resolution purposes.
              You can request deletion at any time (see Section 8).
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              7 &mdash; Security
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              We use reasonable administrative, technical, and organizational safeguards designed to
              protect your information (such as encryption in transit and access controls). No system
              is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              8 &mdash; Your choices and rights
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              You may request to access or delete your data by contacting us at{" "}
              <a href="mailto:privacy@memo-bot.com" className="link-accent">
                privacy@memo-bot.com
              </a>
              . You can also request deletion by sending &ldquo;DELETE&rdquo; to MemoBot on WhatsApp.
              We will respond within a reasonable timeframe and as required by applicable law.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              9 &mdash; International transfers
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              Your information may be processed in countries other than your own, depending on where
              our providers operate. We take steps to protect your information consistent with this
              policy and applicable law.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              10 &mdash; Children
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              MemoBot is not intended for children under 13. Do not use the Service if you are under
              this age.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-[var(--accent)] text-sm font-bold uppercase tracking-widest mb-3">
              11 &mdash; Changes to this policy
            </h2>
            <p className="text-[var(--foreground-muted)] leading-relaxed">
              We may update this policy from time to time. The latest version will always be posted at
              this URL with an updated effective date.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[var(--card-border)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[var(--muted)] text-xs">
              &copy; {new Date().getFullYear()} MemoBot. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <a href="mailto:privacy@memo-bot.com" className="link-accent">
                privacy@memo-bot.com
              </a>
              <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                Home
              </Link>
              <Link href="/pricing" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
