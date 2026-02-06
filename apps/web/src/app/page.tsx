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
      <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-2 flex items-center justify-between bg-transparent">
        <div className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/images/MemoBot_logo.png"
            alt="MemoBot Logo"
            width={32}
            height={32}
            className="rounded w-7 h-7 sm:w-8 sm:h-8"
          />
          <span 
            className="text-lg sm:text-xl font-display tracking-widest text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            MEMOBOT
          </span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          <SignedOut>
            <Link 
              href="/sign-in" 
              className="glitch-hover text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors tracking-wider hidden sm:block"
            >
              SIGN IN
            </Link>
            <Link href="/sign-up" className="btn-accent text-xs py-1.5 px-2 sm:px-3 whitespace-nowrap">
              GET STARTED
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-accent text-xs py-1.5 px-2 sm:px-3 whitespace-nowrap">
              DASHBOARD
            </Link>
          </SignedIn>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-20 flex flex-col items-start justify-end min-h-screen px-6 pb-16 pt-16">
        {/* Content Box - Bottom Left */}
        <div className="bg-black/5 backdrop-blur-sm rounded-lg border border-[var(--card-border)] p-8 w-[360px]">
          {/* Headline */}
          <h1 
            className="text-2xl md:text-3xl font-display tracking-wide text-[var(--foreground)] mb-4 leading-tight"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            CAPTURE ANY THOUGHT IN 5 SECONDS.{" "}
            <span className="text-[var(--accent)]">AI DOES THE REST.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-[var(--muted)] max-w-xl mb-6 leading-relaxed text-sm md:text-base">
            Text an idea to WhatsApp or Telegram. MemoBot enriches it with context, organizes it automatically, and connects it to everything you&apos;ve saved — so nothing gets lost.
          </p>

          {/* Trust indicator */}
          <div className="terminal-text text-[var(--muted-light)] text-xs mb-6 tracking-wider">
            <span className="text-[var(--accent)]">&gt;</span> FREE FOREVER PLAN &middot; NO CREDIT CARD REQUIRED
          </div>

          {/* Auth buttons */}
          <SignedOut>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/sign-up" className="btn-accent text-base py-3 px-8">
                START FREE — NO SIGNUP HASSLE
              </Link>
              <a href="#how-it-works" className="btn-outline text-base py-3 px-8">
                SEE HOW IT WORKS
              </a>
            </div>
          </SignedOut>

          <SignedIn>
            <div>
              <Link href="/dashboard" className="btn-accent text-base py-3 px-8">
                GO TO DASHBOARD
              </Link>
            </div>
          </SignedIn>
        </div>
      </section>

      {/* Problem Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-4xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-12"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            YOU ALREADY KNOW THIS FEELING
          </h2>

          <div className="grid gap-6 md:grid-cols-3 mb-12">
            <div className="card-dystopian glitch-hover p-6 text-center">
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                A great idea hits you mid-conversation. You tell yourself you&apos;ll write it down later. <span className="text-[var(--foreground)]">You won&apos;t.</span>
              </p>
            </div>

            <div className="card-dystopian glitch-hover p-6 text-center">
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Notes in Apple Notes. Voice memos in WhatsApp. Screenshots in your camera roll. Bookmarks in Chrome. <span className="text-[var(--foreground)]">Good luck piecing that together.</span>
              </p>
            </div>

            <div className="card-dystopian glitch-hover p-6 text-center">
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                You saved something important three months ago. You know it&apos;s somewhere. <span className="text-[var(--foreground)]">&quot;Somewhere&quot; isn&apos;t good enough.</span>
              </p>
            </div>
          </div>

          <div className="card-dystopian p-6 max-w-2xl mx-auto">
            <p className="text-center text-[var(--accent)] text-base md:text-lg leading-relaxed">
              The average person loses 3–4 valuable ideas per week to friction and forgetting. MemoBot exists to make that number zero.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-20 py-20 px-6 bg-[var(--background-alt)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-5xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-4"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            THREE STEPS. ZERO EFFORT.
          </h2>
          <p className="text-center text-[var(--muted)] mb-12 max-w-2xl mx-auto text-base md:text-lg">
            What if saving a thought was as easy as texting a friend? It is now.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Step 1 */}
            <div className="card-dystopian glitch-hover p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//01</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">TEXT IT</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Open WhatsApp or Telegram — apps you already use every day. Type a thought, snap a photo, or forward a link. That&apos;s it.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-dystopian glitch-hover p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//02</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">AI ENRICHES IT</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                MemoBot asks smart follow-up questions — why it matters, when it happened, what sparked it — capturing context you&apos;d normally forget within minutes.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-dystopian glitch-hover p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//03</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">FIND IT INSTANTLY</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Search by meaning, not exact keywords. Ask &quot;that restaurant idea from last summer&quot; and get it. MemoBot also surfaces connections between ideas you never noticed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background)]/5 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-12"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            EVERYTHING YOUR NOTES APP SHOULD HAVE BEEN
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Works Where You Already Are</h4>
                <p className="text-sm text-[var(--muted)]">WhatsApp. Telegram. Web dashboard. Send text, photos, docs, or voice notes — no new app to learn.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">AI That Asks What You&apos;d Forget</h4>
                <p className="text-sm text-[var(--muted)]">MemoBot prompts for context, emotion, and details — then auto-generates titles, summaries, categories, and tags.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Search by Meaning, Not Keywords</h4>
                <p className="text-sm text-[var(--muted)]">Ask &quot;that startup idea from the beach trip&quot; and find it instantly. Semantic search understands what you meant, not just what you typed.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Discover Hidden Connections</h4>
                <p className="text-sm text-[var(--muted)]">MemoBot&apos;s relationship graph reveals links between ideas saved weeks or months apart — sparking insights you&apos;d never find manually.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Organized Without Organizing</h4>
                <p className="text-sm text-[var(--muted)]">Every memory is auto-categorized, auto-tagged, and searchable the moment you save it. Zero folders. Zero filing.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Private and Encrypted</h4>
                <p className="text-sm text-[var(--muted)]">End-to-end encrypted storage. Your memories are yours alone — no training data, no third-party access, no exceptions.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background-alt)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-5xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-12"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            PEOPLE WHO NEVER LOSE IDEAS ANYMORE
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="card-dystopian glitch-hover p-6">
              <p className="text-[var(--muted)] text-sm leading-relaxed mb-4 italic">
                &quot;I used to screenshot everything and forget where I put it. Now I text MemoBot and move on with my day. Three months in and I&apos;ve saved over 200 memories without thinking twice.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold">
                  AR
                </div>
                <div>
                  <p className="text-[var(--foreground)] text-sm font-semibold">Alex R.</p>
                  <p className="text-[var(--muted-light)] text-xs">Product Designer</p>
                </div>
              </div>
            </div>

            <div className="card-dystopian glitch-hover p-6">
              <p className="text-[var(--muted)] text-sm leading-relaxed mb-4 italic">
                &quot;I searched &apos;that podcast guest who talked about pricing&apos; and MemoBot found a note from six months ago I&apos;d completely forgotten. The semantic search alone is worth it.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold">
                  JM
                </div>
                <div>
                  <p className="text-[var(--foreground)] text-sm font-semibold">Jordan M.</p>
                  <p className="text-[var(--muted-light)] text-xs">Startup Founder</p>
                </div>
              </div>
            </div>

            <div className="card-dystopian glitch-hover p-6">
              <p className="text-[var(--muted)] text-sm leading-relaxed mb-4 italic">
                &quot;My team keeps asking how I always remember every detail from every meeting. I don&apos;t tell them it&apos;s just MemoBot on Telegram.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold">
                  SK
                </div>
                <div>
                  <p className="text-[var(--foreground)] text-sm font-semibold">Sam K.</p>
                  <p className="text-[var(--muted-light)] text-xs">Creative Director</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-2xl mx-auto">
          <div className="card-dystopian p-8 text-center">
            <h2 
              className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] mb-4"
              style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
            >
              YOUR NEXT GREAT IDEA IS 5 MINUTES AWAY
            </h2>
            <p className="text-[var(--muted)] mb-4 text-base md:text-lg">
              You&apos;ll have another idea today. Maybe in the shower. Maybe on a walk. Maybe mid-meeting. This time, it takes one text to save it forever.
            </p>
            <p className="text-[var(--accent)] text-sm mb-8">
              Free forever plan available. No credit card. No commitment.
            </p>
            <SignedOut>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/sign-up" className="btn-accent text-base py-3 px-8">
                  START FREE NOW
                </Link>
                <Link href="/pricing" className="btn-outline text-base py-3 px-8">
                  VIEW PRICING
                </Link>
              </div>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn-accent text-base py-3 px-8">
                GO TO DASHBOARD
              </Link>
            </SignedIn>
          </div>
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
            <span className="text-[var(--accent)]">//</span> CAPTURE EVERYTHING. FORGET NOTHING.
          </div>
        </div>
      </footer>
    </main>
  );
}
