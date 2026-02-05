import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <Link href="/" className="flex flex-col items-center gap-3">
          <Image
            src="/images/MemoBot_logo.png"
            alt="MemoBot Logo"
            width={64}
            height={64}
            className="rounded"
          />
          <h1 
            className="text-4xl font-display tracking-widest text-[var(--foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            MEMOBOT
          </h1>
        </Link>
        <p className="text-xs text-[var(--muted)] tracking-wider mt-2">
          <span className="text-[var(--accent)]">//</span> TERMINAL ACCESS
        </p>
      </div>

      {/* Clerk Sign In */}
      <SignIn
        afterSignInUrl="/dashboard"
        signUpUrl="/sign-up"
      />

      {/* Footer */}
      <div className="mt-8 text-xs text-[var(--muted-light)] tracking-wider">
        <span className="text-[var(--accent)]">&gt;</span> SECURE CONNECTION ESTABLISHED
      </div>
    </main>
  );
}
