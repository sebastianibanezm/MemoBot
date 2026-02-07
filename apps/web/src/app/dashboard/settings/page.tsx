"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface PlatformLink {
  id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string | null;
  linked_at: string;
}

interface SubscriptionInfo {
  status: string;
  tier: string;
  isActive: boolean;
  currentPeriodEnd: string | null;
  priceId: string | null;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<PlatformLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [syncSettings, setSyncSettings] = useState<{
    local_backup_enabled: boolean;
    local_backup_path: string | null;
    google_drive_enabled: boolean;
    dropbox_enabled: boolean;
  } | null>(null);
  const [localBackupEnabled, setLocalBackupEnabled] = useState(true);
  const [localBackupPath, setLocalBackupPath] = useState("");
  const [savingSync, setSavingSync] = useState(false);

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Check for successful checkout redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setCheckoutSuccess(true);
      // Refetch subscription after successful checkout
      fetchSubscription();
      // Clear the URL params
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [searchParams]);

  // Fetch subscription info
  const fetchSubscription = () => {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSubscription(data);
        }
      })
      .catch(() => setSubscription(null))
      .finally(() => setLoadingSubscription(false));
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  useEffect(() => {
    fetch("/api/linked-accounts")
      .then((res) => (res.ok ? res.json() : { links: [] }))
      .then((data) => {
        setLinkedAccounts(data.links ?? []);
      })
      .catch(() => setLinkedAccounts([]))
      .finally(() => setLoadingLinks(false));
  }, []);

  useEffect(() => {
    fetch("/api/settings/sync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSyncSettings(data);
          setLocalBackupEnabled(data.local_backup_enabled ?? true);
          setLocalBackupPath(data.local_backup_path ?? "");
        }
      })
      .catch(() => {});
  }, []);

  const saveSyncSettings = async () => {
    setSavingSync(true);
    try {
      const res = await fetch("/api/settings/sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          local_backup_enabled: localBackupEnabled,
          local_backup_path: localBackupPath || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncSettings(data);
      }
    } finally {
      setSavingSync(false);
    }
  };

  const connectWhatsApp = async () => {
    if (!whatsappPhone.trim()) {
      setWhatsappError("Please enter your phone number");
      return;
    }
    setGenerating("whatsapp");
    setWhatsappError(null);
    try {
      const res = await fetch("/api/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "whatsapp", phoneNumber: whatsappPhone }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setWhatsappCode(data.code);
        setWhatsappSent(true);
      } else {
        setWhatsappError(data.error || "Failed to send verification code");
      }
    } catch {
      setWhatsappError("Network error. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  const generateCode = async (platform: "telegram") => {
    setGenerating(platform);
    try {
      const res = await fetch("/api/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setTelegramCode(data.code);
      }
    } finally {
      setGenerating(null);
    }
  };

  const copyCode = (code: string, platform: string) => {
    navigator.clipboard.writeText(`LINK ${code}`);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("Failed to open billing portal");
    } finally {
      setOpeningPortal(false);
    }
  };

  const getTierDisplayName = (tier: string) => {
    const names: Record<string, string> = {
      free: "Free",
      pro: "Pro",
      enterprise: "Enterprise",
    };
    return names[tier] || tier;
  };

  const getTierBadgeClass = (tier: string) => {
    const classes: Record<string, string> = {
      free: "bg-gray-500/20 text-gray-400",
      pro: "bg-[var(--accent)]/20 text-[var(--accent)]",
      enterprise: "bg-purple-500/20 text-purple-400",
    };
    return classes[tier] || classes.free;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <main className="p-6 pb-20 max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/dashboard"
            className="link-accent text-sm inline-flex items-center gap-2 mb-4"
          >
            <span>&larr;</span> DASHBOARD
          </Link>
          <h1 
            className="text-3xl font-display tracking-widest text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            SYSTEM SETTINGS
          </h1>
        </div>

        {/* Checkout Success Message */}
        {checkoutSuccess && (
          <div className="p-4 rounded bg-green-500/20 border border-green-500/40 text-green-400">
            <p className="font-medium">Welcome to MemoBot Pro!</p>
            <p className="text-sm opacity-80">Your subscription is now active. Enjoy unlimited features.</p>
          </div>
        )}

        {/* Subscription Section */}
        <section>
          <h2 
            className="text-xl font-display tracking-widest text-[var(--foreground)] mb-2"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            SUBSCRIPTION
          </h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            <span className="text-[var(--accent)]">//</span> Manage your subscription and billing.
          </p>

          <div className="card-dystopian p-6">
            {loadingSubscription ? (
              <p className="text-[var(--muted)] text-sm">
                <span className="text-[var(--accent)]">&gt;</span> LOADING SUBSCRIPTION...
              </p>
            ) : (
              <div className="space-y-4">
                {/* Current Plan */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
                      Current Plan
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-semibold text-[var(--foreground)]">
                        {getTierDisplayName(subscription?.tier || "free")}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTierBadgeClass(subscription?.tier || "free")}`}>
                        {subscription?.isActive ? "ACTIVE" : subscription?.status?.toUpperCase() || "INACTIVE"}
                      </span>
                    </div>
                  </div>
                  {subscription?.tier === "free" ? (
                    <Link href="/pricing" className="btn-accent text-sm">
                      UPGRADE
                    </Link>
                  ) : subscription?.isActive ? (
                    <button
                      onClick={openBillingPortal}
                      disabled={openingPortal}
                      className="btn-outline text-sm disabled:opacity-50"
                    >
                      {openingPortal ? "LOADING..." : "MANAGE BILLING"}
                    </button>
                  ) : null}
                </div>

                {/* Renewal Date */}
                {subscription?.currentPeriodEnd && subscription?.isActive && (
                  <div className="pt-3 border-t border-[var(--card-border)]">
                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
                      Next Billing Date
                    </p>
                    <p className="text-[var(--foreground)]">
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                )}

                {/* Past Due Warning */}
                {subscription?.status === "past_due" && (
                  <div className="p-3 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm">
                    <p className="font-medium">Payment Failed</p>
                    <p className="opacity-80">Please update your payment method to continue using Pro features.</p>
                    <button
                      onClick={openBillingPortal}
                      disabled={openingPortal}
                      className="mt-2 text-xs underline hover:no-underline"
                    >
                      Update Payment Method
                    </button>
                  </div>
                )}

                {/* Canceled Info */}
                {subscription?.status === "canceled" && (
                  <div className="p-3 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
                    <p className="font-medium">Subscription Canceled</p>
                    <p className="opacity-80">
                      Your subscription has been canceled.{" "}
                      <Link href="/pricing" className="underline hover:no-underline">
                        Resubscribe
                      </Link>{" "}
                      to regain access to Pro features.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Account Linking Section */}
        <section>
          <h2 
            className="text-xl font-display tracking-widest text-[var(--foreground)] mb-2"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            LINK MESSAGING ACCOUNTS
          </h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            <span className="text-[var(--accent)]">//</span> Connect your messaging accounts to use MemoBot on WhatsApp or Telegram.
          </p>

          {/* WhatsApp */}
          <div className="card-dystopian p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[var(--accent)] font-mono text-sm">//WA</span>
              <h3 className="text-lg font-medium text-[var(--foreground)]">WhatsApp</h3>
            </div>
            {!whatsappSent ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Enter your phone number with country code to receive a verification message on WhatsApp.
                </p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={whatsappPhone}
                    onChange={(e) => {
                      setWhatsappPhone(e.target.value);
                      setWhatsappError(null);
                    }}
                    placeholder="+1 234 567 8900"
                    className="flex-1 px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors font-mono text-sm"
                    disabled={generating === "whatsapp"}
                  />
                  <button
                    type="button"
                    onClick={connectWhatsApp}
                    disabled={!!generating || !whatsappPhone.trim()}
                    className="btn-accent text-sm disabled:opacity-50 whitespace-nowrap"
                  >
                    {generating === "whatsapp" ? "SENDING..." : "CONNECT"}
                  </button>
                </div>
                {whatsappError && (
                  <p className="text-xs text-red-400">{whatsappError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded bg-green-500/10 border border-green-500/30">
                  <p className="text-sm text-green-400 font-medium">
                    Verification message sent to {whatsappPhone}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Check your WhatsApp and reply to the message with the code below to complete the connection.
                  </p>
                </div>
                <div className="flex items-center gap-2 p-3 rounded bg-[var(--background-alt)] border border-[var(--card-border)] font-mono text-[var(--accent)]">
                  <span>LINK {whatsappCode}</span>
                  <button
                    type="button"
                    onClick={() => copyCode(whatsappCode!, "whatsapp")}
                    className="ml-auto px-2 py-1 rounded hover:bg-[var(--accent-muted)] transition-colors text-xs"
                    title="Copy"
                  >
                    {copied === "whatsapp" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <p className="text-xs text-[var(--muted-light)]">Code expires in 10 minutes</p>
                <button
                  type="button"
                  onClick={() => {
                    setWhatsappSent(false);
                    setWhatsappCode(null);
                    setWhatsappPhone("");
                  }}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors underline"
                >
                  Use a different number
                </button>
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className="card-dystopian p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[var(--accent)] font-mono text-sm">//TG</span>
              <h3 className="text-lg font-medium text-[var(--foreground)]">Telegram</h3>
            </div>
            {!telegramCode ? (
              <button
                type="button"
                onClick={() => generateCode("telegram")}
                disabled={!!generating}
                className="btn-outline text-sm disabled:opacity-50"
              >
                {generating === "telegram" ? "GENERATING..." : "GENERATE LINK CODE"}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Send this message to MemoBot on Telegram:
                </p>
                <div className="flex items-center gap-2 p-3 rounded bg-[var(--background-alt)] border border-[var(--card-border)] font-mono text-[var(--accent)]">
                  <span>LINK {telegramCode}</span>
                  <button
                    type="button"
                    onClick={() => copyCode(telegramCode, "telegram")}
                    className="ml-auto px-2 py-1 rounded hover:bg-[var(--accent-muted)] transition-colors text-xs"
                    title="Copy"
                  >
                    {copied === "telegram" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <p className="text-xs text-[var(--muted-light)]">Code expires in 10 minutes</p>
              </div>
            )}
          </div>

          {/* Linked Accounts */}
          <div className="card-dystopian p-6">
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-4">
              Linked Accounts
            </h3>
            {loadingLinks ? (
              <p className="text-[var(--muted)] text-sm">
                <span className="text-[var(--accent)]">&gt;</span> SCANNING CONNECTIONS...
              </p>
            ) : linkedAccounts.length === 0 ? (
              <p className="text-[var(--muted)] text-sm">No accounts linked yet.</p>
            ) : (
              <ul className="space-y-2">
                {linkedAccounts.map((link) => (
                  <li
                    key={link.id}
                    className="flex justify-between items-center py-2 border-b border-[var(--card-border)] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--accent)] font-mono">
                        //{link.platform.toUpperCase().slice(0, 2)}
                      </span>
                      <span className="font-mono text-sm text-[var(--foreground)]">
                        {link.platform_username || link.platform_user_id}
                      </span>
                    </div>
                    <span className="badge-muted text-[10px]">CONNECTED</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Sync & Backup Section */}
        <section>
          <h2 
            className="text-xl font-display tracking-widest text-[var(--foreground)] mb-2"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            SYNC & BACKUP
          </h2>
          <p className="text-[var(--muted)] text-sm mb-4">
            <span className="text-[var(--accent)]">//</span> Local backup exports memories as markdown files.
          </p>
          
          <div className="card-dystopian p-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localBackupEnabled}
                onChange={(e) => setLocalBackupEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--card-border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 bg-[var(--background)]"
              />
              <span className="text-[var(--foreground)]">Enable local backup</span>
            </label>
            
            <div>
              <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
                Local backup path
              </label>
              <input
                type="text"
                value={localBackupPath}
                onChange={(e) => setLocalBackupPath(e.target.value)}
                placeholder="/path/to/backup"
                className="w-full px-3 py-2 rounded border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors font-mono text-sm"
              />
            </div>
            
            <button
              type="button"
              onClick={saveSyncSettings}
              disabled={savingSync}
              className="btn-accent text-sm disabled:opacity-50"
            >
              {savingSync ? "SAVING..." : "SAVE SETTINGS"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
