"use client";

import Link from "next/link";
import ChatImport from "@/components/ChatImport";

export default function ImportPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-cyan-400 hover:text-cyan-300 text-sm mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mb-2">Import Memories</h1>
          <p className="text-gray-400">
            Bring your existing conversations into MemoBot. Upload a chat export and 
            I&apos;ll extract the important stuff — events, plans, facts, and ideas — 
            and organize everything for you.
          </p>
        </div>

        {/* Import Component */}
        <ChatImport />

        {/* Info Section */}
        <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
          <h3 className="font-medium text-gray-300 mb-2">What gets imported?</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Substantive messages (events, plans, facts, ideas)</li>
            <li>• Messages are clustered by sender and time</li>
            <li>• Auto-categorized and tagged</li>
            <li>• Related memories are automatically linked</li>
          </ul>
          
          <h3 className="font-medium text-gray-300 mt-4 mb-2">What gets filtered out?</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Short messages (ok, lol, thanks, etc.)</li>
            <li>• System messages (X joined the group, etc.)</li>
            <li>• Media placeholders (photo omitted, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
