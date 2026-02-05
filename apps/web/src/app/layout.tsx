import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, Bebas_Neue, Orbitron } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: ["400"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "MemoBot",
  description: "AI memory assistant — enrich, categorize, and search your memories",
  icons: {
    icon: "/images/MemoBot_logo.ico",
    shortcut: "/images/MemoBot_logo.ico",
    apple: "/images/MemoBot_logo.png",
  },
};

const clerkAppearance = {
  baseTheme: undefined,
  variables: {
    colorPrimary: "#00b34a",
    colorBackground: "#0a0a0a",
    colorInputBackground: "#141414",
    colorInputText: "#e8e4db",
    colorText: "#e8e4db",
    colorTextSecondary: "#9a958c",
    borderRadius: "0.25rem",
    fontFamily: "IBM Plex Mono, monospace",
  },
  elements: {
    formButtonPrimary:
      "bg-transparent text-[#00b34a] border border-[#00b34a] hover:bg-[#00b34a]/15 uppercase tracking-wider text-sm font-medium",
    card: "bg-[#0a0a0a] border border-[#00b34a]/15 shadow-none",
    headerTitle: "text-[#e8e4db] font-bold tracking-wider uppercase",
    headerSubtitle: "text-[#9a958c]",
    socialButtonsBlockButton: "border-[#00b34a]/15 bg-[#141414] hover:bg-[#1a1a1a]",
    socialButtonsBlockButtonText: "!text-[#e8e4db] font-medium",
    socialButtonsProviderIcon: "brightness-0 invert",
    socialButtonsBlockButtonArrow: "!text-[#e8e4db]",
    formFieldLabel: "text-[#e8e4db] uppercase text-xs tracking-wider",
    formFieldInput: "bg-[#141414] border-[#00b34a]/15 text-[#e8e4db] focus:border-[#00b34a] focus:ring-[#00b34a]/20",
    footerActionLink: "text-[#00b34a] hover:text-[#009940]",
    identityPreviewEditButton: "text-[#00b34a] hover:text-[#009940]",
    formFieldInputShowPasswordButton: "text-[#9a958c] hover:text-[#e8e4db]",
    dividerLine: "bg-[#00b34a]/10",
    dividerText: "text-[#9a958c] uppercase text-xs tracking-wider",
    userButtonPopoverCard: "bg-[#0a0a0a] border border-[#00b34a]/15",
    userButtonPopoverActionButton: "text-[#e8e4db] hover:bg-[#141414]",
    userButtonPopoverActionButtonText: "text-[#e8e4db]",
    userButtonPopoverActionButtonIcon: "text-[#9a958c]",
    userButtonPopoverFooter: "border-t border-[#00b34a]/10",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body
          className={`${ibmPlexMono.variable} ${bebasNeue.variable} ${orbitron.variable} antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
