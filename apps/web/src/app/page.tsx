"use client";

import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import ScrollControlledGif from "@/components/ScrollControlledGif";

export default function HomePage() {

  return (
    <main className="relative min-h-screen bg-transparent">
      {/* Scroll-Controlled Background Animation */}
      <ScrollControlledGif
        src="/images/BG_animation.gif"
        className="fixed inset-0 w-full h-screen overflow-hidden z-0"
        scrollDistance={2000}
        loop={true}
        scale={1}
        cropBottom={20}
        overlay={
          <div className="absolute inset-0 bg-black/40" />
        }
      />

      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-2 flex items-center justify-between bg-transparent">
        <div className="flex items-center gap-3">
          <Image
            src="/images/MemoBot_logo.png"
            alt="MemoBot Logo"
            width={32}
            height={32}
            className="rounded"
          />
          <span 
            className="text-xl font-display tracking-widest text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            MEMOBOT
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <SignedOut>
            <Link 
              href="/sign-in" 
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors tracking-wider"
            >
              SIGN IN
            </Link>
            <Link href="/sign-up" className="btn-accent text-xs py-1.5 px-3">
              GET STARTED
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-accent text-xs py-1.5 px-3">
              DASHBOARD
            </Link>
          </SignedIn>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-20 flex flex-col items-start justify-end min-h-screen px-6 pb-16 pt-16">
        {/* Content Box - Bottom Left */}
        <div className="bg-black/5 backdrop-blur-sm rounded-lg border border-[var(--card-border)] p-8 w-[360px]">
          {/* Tagline with terminal aesthetic */}
          <div className="terminal-text text-[var(--muted)] text-sm md:text-base mb-6 tracking-wider">
            <span className="text-[var(--accent)]">&gt;</span> YOUR AI MEMORY ASSISTANT
          </div>

          {/* Description */}
          <p className="text-[var(--muted)] max-w-xl mb-8 leading-relaxed text-base md:text-lg">
            Capture, enrich, and interconnect your memories through AI.
            <br />
            <span className="text-[var(--accent-dark)]">Every thought preserved. Every connection revealed.</span>
          </p>

          {/* Auth buttons */}
          <SignedOut>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/sign-up" className="btn-accent text-base py-3 px-8">
                START FREE
              </Link>
              <Link href="/sign-in" className="btn-outline text-base py-3 px-8">
                SIGN IN
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <div>
              <Link href="/dashboard" className="btn-accent text-base py-3 px-8">
                ENTER MEMORY VAULT
              </Link>
            </div>
          </SignedIn>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background-alt)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-5xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-4"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            HOW IT WORKS
          </h2>
          <p className="text-center text-[var(--muted)] mb-12 max-w-2xl mx-auto">
            MemoBot transforms how you capture and retrieve memories. Simply message your thoughts via WhatsApp or Telegram, and let AI do the rest.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="card-dystopian p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//01</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">CAPTURE</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Send memories via WhatsApp or Telegram. Our AI assistant asks smart follow-up questions to enrich your entries with context and detail.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card-dystopian p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//02</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">ORGANIZE</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Memories are automatically categorized and tagged. The AI learns your personal taxonomy, creating a structured archive of your thoughts.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card-dystopian p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//03</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">CONNECT</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Semantic search finds related memories across your archive. Discover hidden connections between ideas, events, and experiences.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background)]/5 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-12"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            FEATURES
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Multi-Platform Access</h4>
                <p className="text-sm text-[var(--muted)]">Capture memories via WhatsApp, Telegram, or the web dashboard</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">AI-Powered Enrichment</h4>
                <p className="text-sm text-[var(--muted)]">Smart follow-up questions extract context and meaning</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Semantic Search</h4>
                <p className="text-sm text-[var(--muted)]">Find memories by meaning, not just keywords</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Relationship Discovery</h4>
                <p className="text-sm text-[var(--muted)]">Visualize connections between memories in a network graph</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Auto-Categorization</h4>
                <p className="text-sm text-[var(--muted)]">Intelligent tagging and category assignment</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Secure & Private</h4>
                <p className="text-sm text-[var(--muted)]">Your memories are encrypted and isolated per user</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background-alt)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] mb-4"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            START PRESERVING YOUR MEMORIES
          </h2>
          <p className="text-[var(--muted)] mb-8">
            Join MemoBot and never lose an important thought again.
          </p>
          <SignedOut>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-up" className="btn-accent text-base py-3 px-8">
                CREATE FREE ACCOUNT
              </Link>
              <Link href="/sign-in" className="btn-outline text-base py-3 px-8">
                SIGN IN
              </Link>
            </div>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-accent text-base py-3 px-8">
              GO TO DASHBOARD
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 py-8 px-6 bg-[var(--background)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/MemoBot_logo.png"
              alt="MemoBot Logo"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-sm text-[var(--muted)]">
              MemoBot &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="text-xs text-[var(--muted-light)] tracking-wider">
            <span className="text-[var(--accent)]">//</span> SYS.STATUS: OPERATIONAL
          </div>
        </div>
      </footer>
    </main>
  );
}
