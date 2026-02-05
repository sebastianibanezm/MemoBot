"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";

interface PlanFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const features: PlanFeature[] = [
  { name: "Memories", free: "100", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "AI Conversations", free: "50/month", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "Attachments", free: "10", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "WhatsApp & Telegram", free: true, pro: true, enterprise: true },
  { name: "Semantic Search", free: true, pro: true, enterprise: true },
  { name: "Memory Graph", free: false, pro: true, enterprise: true },
  { name: "Cloud Sync", free: false, pro: true, enterprise: true },
  { name: "Priority Support", free: false, pro: false, enterprise: true },
  { name: "Custom Integrations", free: false, pro: false, enterprise: true },
];

const plans = [
  {
    id: "free",
    name: "Free",
    description: "Get started with basic memory capture",
    price: { monthly: 0, yearly: 0 },
    cta: "Current Plan",
    ctaVariant: "outline" as const,
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Unlimited memories and advanced features",
    price: { monthly: 9, yearly: 90 },
    cta: "Upgrade to Pro",
    ctaVariant: "accent" as const,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For teams and power users",
    price: { monthly: 29, yearly: 290 },
    cta: "Contact Us",
    ctaVariant: "outline" as const,
    popular: false,
  },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    if (planId === "free") return;
    if (planId === "enterprise") {
      // Open contact form or email
      window.location.href = "mailto:support@memo-bot.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    if (!isSignedIn) {
      window.location.href = "/sign-up";
      return;
    }

    setLoading(planId);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingInterval,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        alert(data.error || "Failed to start checkout");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--background-alt)] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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
            {isSignedIn ? (
              <Link href="/dashboard" className="btn-outline text-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                  Sign In
                </Link>
                <Link href="/sign-up" className="btn-accent text-sm">
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 
            className="text-4xl md:text-5xl font-display tracking-widest mb-4"
            style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
          >
            CHOOSE YOUR PLAN
          </h1>
          <p className="text-[var(--muted)] text-lg max-w-2xl mx-auto">
            Start free and upgrade when you need more power. All plans include core memory features.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-[var(--card)] border border-[var(--card-border)]">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                billingInterval === "monthly"
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("yearly")}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                billingInterval === "yearly"
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-400">(Save 17%)</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative card-dystopian p-6 flex flex-col ${
                plan.popular ? "ring-2 ring-[var(--accent)]" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--accent)] text-[var(--background)] text-xs font-bold rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h2 
                  className="text-2xl font-display tracking-widest mb-2"
                  style={{ fontFamily: "var(--font-bebas-neue), sans-serif" }}
                >
                  {plan.name}
                </h2>
                <p className="text-[var(--muted)] text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[var(--foreground)]">
                    ${billingInterval === "yearly" ? plan.price.yearly : plan.price.monthly}
                  </span>
                  <span className="text-[var(--muted)]">
                    /{billingInterval === "yearly" ? "year" : "month"}
                  </span>
                </div>
                {billingInterval === "yearly" && plan.price.yearly > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    ${(plan.price.yearly / 12).toFixed(2)}/month
                  </p>
                )}
              </div>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null || plan.id === "free"}
                className={`w-full py-3 rounded font-medium text-sm uppercase tracking-wider transition-all ${
                  plan.ctaVariant === "accent"
                    ? "btn-accent"
                    : "btn-outline"
                } ${plan.id === "free" ? "opacity-50 cursor-not-allowed" : ""} ${
                  loading === plan.id ? "opacity-70" : ""
                }`}
              >
                {loading === plan.id ? "Loading..." : plan.cta}
              </button>

              <ul className="mt-6 space-y-3 flex-1">
                {features.map((feature) => {
                  const value = feature[plan.id as keyof PlanFeature];
                  const included = value === true || (typeof value === "string" && value !== "");
                  
                  return (
                    <li key={feature.name} className="flex items-center gap-2 text-sm">
                      <span className={included ? "text-[var(--accent)]" : "text-[var(--muted-light)]"}>
                        {included ? "+" : "-"}
                      </span>
                      <span className={included ? "text-[var(--foreground)]" : "text-[var(--muted-light)] line-through"}>
                        {feature.name}
                        {typeof value === "string" && value !== "" && (
                          <span className="text-[var(--muted)] ml-1">({value})</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="text-center">
          <p className="text-[var(--muted)] text-sm">
            Questions? <a href="mailto:support@memo-bot.com" className="link-accent">Contact us</a>
          </p>
        </div>
      </main>
    </div>
  );
}
