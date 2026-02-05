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
              className="glitch-hover text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors tracking-wider"
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
          {/* Headline */}
          <h1 
            className="text-2xl md:text-3xl font-display tracking-wide text-[var(--foreground)] mb-4 leading-tight"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            YOUR BRILLIANT IDEAS ARE SLIPPING AWAY.{" "}
            <span className="text-[var(--accent)]">STOP THE LEAK.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-[var(--muted)] max-w-xl mb-6 leading-relaxed text-sm md:text-base">
            Just text your thoughts to WhatsApp or Telegram. MemoBot captures, enriches, and connects them automatically — so you never lose another insight.
          </p>

          {/* Trust indicator */}
          <div className="terminal-text text-[var(--muted-light)] text-xs mb-6 tracking-wider">
            <span className="text-[var(--accent)]">&gt;</span> TRUSTED BY 500+ EARLY ADOPTERS
          </div>

          {/* Auth buttons */}
          <SignedOut>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/sign-up" className="btn-accent text-base py-3 px-8">
                START FREE TRIAL
              </Link>
              <a href="#how-it-works" className="btn-outline text-base py-3 px-8">
                SEE HOW IT WORKS
              </a>
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

      {/* Problem Section */}
      <section className="relative z-20 py-20 px-6 bg-[var(--background)]/5 backdrop-blur-sm border-t border-[var(--card-border)]">
        <div className="max-w-4xl mx-auto">
          <h2 
            className="text-3xl md:text-4xl font-display tracking-widest text-[var(--foreground)] text-center mb-12"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            SOUND FAMILIAR?
          </h2>

          <div className="grid gap-6 md:grid-cols-3 mb-12">
            <div className="card-dystopian glitch-hover p-6 text-center">
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                You had a brilliant idea in the shower. By the time you found a notes app, <span className="text-[var(--foreground)]">it was gone.</span>
              </p>
            </div>

            <div className="card-dystopian glitch-hover p-6 text-center">
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Your notes are scattered across 5 apps, 3 devices, and a stack of paper. <span className="text-[var(--foreground)]">Good luck finding anything.</span>
              </p>
            </div>

            <div className="card-dystopian glitch-hover p-6 text-center">
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                You wrote something important 6 months ago. You know it exists. <span className="text-[var(--foreground)]">But you&apos;ll never find it.</span>
              </p>
            </div>
          </div>

          <div className="card-dystopian p-6 max-w-2xl mx-auto">
            <p className="text-center text-[var(--accent)] text-base md:text-lg leading-relaxed">
              Every forgotten idea is a missed opportunity. Every buried note is wasted potential. Your thoughts deserve better than digital chaos.
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
            THE MEMOBOT DIFFERENCE
          </h2>
          <p className="text-center text-[var(--muted)] mb-12 max-w-2xl mx-auto text-base md:text-lg">
            What if capturing a memory was as easy as texting a friend?
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Step 1 */}
            <div className="card-dystopian glitch-hover p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//01</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">TEXT</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Message your thought to WhatsApp or Telegram. No app to open. No friction. Just talk.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-dystopian glitch-hover p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//02</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">ENRICH</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Our AI asks the right questions to capture context you&apos;d forget. Why it matters. How you felt. What sparked it.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-dystopian glitch-hover p-6">
              <div className="text-[var(--accent)] font-mono text-sm mb-3">//03</div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">DISCOVER</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">
                Search by meaning, not keywords. Find connections you never knew existed. Your second brain, fully wired.
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
            BUILT FOR HOW YOUR MIND ACTUALLY WORKS
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Text From Anywhere</h4>
                <p className="text-sm text-[var(--muted)]">WhatsApp. Telegram. Web. Capture thoughts wherever you are.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Never Lose Context Again</h4>
                <p className="text-sm text-[var(--muted)]">Our AI asks what you&apos;d forget to write down.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Find It Like You Think It</h4>
                <p className="text-sm text-[var(--muted)]">Search &quot;that startup idea from the beach trip&quot; and find it.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">See The Hidden Threads</h4>
                <p className="text-sm text-[var(--muted)]">Discover surprising connections between your ideas.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Organized Without Organizing</h4>
                <p className="text-sm text-[var(--muted)]">Auto-tagged. Auto-sorted. Zero effort.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Your Vault. Your Keys.</h4>
                <p className="text-sm text-[var(--muted)]">End-to-end encrypted. Only you see your memories.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Attach Files, Not Friction</h4>
                <p className="text-sm text-[var(--muted)]">Drop in photos, docs, or voice notes. Everything lives with your memory.</p>
              </div>
            </div>

            <div className="glitch-hover flex items-start gap-4 p-4 rounded border border-[var(--card-border)] bg-[var(--card)]">
              <span className="text-[var(--accent)] text-xl">&#9672;</span>
              <div>
                <h4 className="font-semibold text-[var(--foreground)] mb-1">Never Forget To Follow Up</h4>
                <p className="text-sm text-[var(--muted)]">Your AI sets reminders automatically. Get nudged when it matters.</p>
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
            EARLY ADOPTERS ARE HOOKED
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="card-dystopian glitch-hover p-6">
              <p className="text-[var(--muted)] text-sm leading-relaxed mb-4 italic">
                &quot;I used to lose 10 ideas a day. Now they all go to MemoBot. It&apos;s like having a second brain that actually works.&quot;
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
                &quot;The semantic search is insane. I found a connection between two ideas from 8 months apart. Game changer.&quot;
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
                &quot;Finally, a notes app that doesn&apos;t feel like work. I just text and forget about it. MemoBot remembers everything.&quot;
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
              STOP LOSING YOUR BEST IDEAS
            </h2>
            <p className="text-[var(--muted)] mb-4 text-base md:text-lg">
              Your next breakthrough idea could come in 5 minutes. Will you capture it — or watch it disappear?
            </p>
            <p className="text-[var(--accent)] text-sm mb-8">
              Start your 14-day free trial. No credit card required.
            </p>
            <SignedOut>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/sign-up" className="btn-accent text-base py-3 px-8">
                  START FREE TRIAL
                </Link>
                <Link href="/sign-in" className="btn-outline text-base py-3 px-8">
                  SEE PRICING
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
            <span className="text-[var(--accent)]">//</span> READY TO REMEMBER EVERYTHING
          </div>
        </div>
      </footer>
    </main>
  );
}
