import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { syncUserToSupabase } from "@/lib/sync-user";
import { UserButton } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/dashboard", label: "HOME" },
  { href: "/dashboard/memories", label: "MEMORIES" },
  { href: "/dashboard/reminders", label: "REMINDERS" },
  { href: "/dashboard/categories", label: "CATEGORIES" },
  { href: "/dashboard/tags", label: "TAGS" },
  { href: "/dashboard/graph", label: "GRAPH" },
  { href: "/dashboard/settings", label: "SETTINGS" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  if (user) {
    try {
      await syncUserToSupabase({
        id: user.id,
        email_addresses: user.emailAddresses?.map((e) => ({ email_address: e.emailAddress })),
        first_name: user.firstName ?? undefined,
        last_name: user.lastName ?? undefined,
        image_url: user.imageUrl ?? undefined,
      });
    } catch (e) {
      console.error("[DashboardLayout] User sync failed:", e);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Navigation Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--background-alt)] px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo/Brand */}
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
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

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 flex-wrap">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 text-xs font-medium tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-muted)] rounded transition-all"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* User Button */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted)] tracking-wider hidden sm:block">
            <span className="text-[var(--accent)]">//</span> CONNECTED
          </span>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: { 
                avatarBox: "ring-2 ring-[var(--accent)]/30 hover:ring-[var(--accent)]/60 transition-all",
                userButtonPopoverCard: "bg-[var(--card)] border border-[var(--card-border)]",
              },
            }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">
        {children}
      </main>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[var(--background-alt)] border-t border-[var(--card-border)] px-4 py-2 flex items-center justify-between text-xs text-[var(--muted)] tracking-wider z-50">
        <span>
          <span className="text-[var(--accent)]">&gt;</span> MEMORY_VAULT.ACTIVE
        </span>
        <span className="opacity-60">
          SYS.UPTIME: NOMINAL
        </span>
      </footer>
    </div>
  );
}
