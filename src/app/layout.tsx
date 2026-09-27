import type { Metadata } from "next";
import { Inter, Noto_Sans_Tamil } from "next/font/google";
import Link from "next/link";
import { SessionLink } from "@/components/session-link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-sans-tamil",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thonmai தொண்மை — Know what you qualify for",
  description:
    "Find the Tamil Nadu and central scholarships and benefits you are eligible for, with a plain explanation of why and exactly which documents to take.",
};

const NAV = [
  { href: "/check", label: "Check eligibility", ta: "உரிமையைச் சரிபார்" },
  { href: "/schemes", label: "All schemes", ta: "அனைத்துத் திட்டங்கள்" },
  { href: "/quota", label: "Quota guide", ta: "கிடைமட்ட வழிகாட்டி" },
  { href: "/documents", label: "What to upload", ta: "என்ன பதிவேற்றவும்" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoTamil.variable}`}>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-clay-500 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>

        <header className="border-b border-clay-100 bg-paper/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight">Thonmai</span>
              <span className="ta text-base text-clay-600">தொண்மை</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-2.5 py-1.5 font-medium text-ink-soft hover:bg-clay-50 hover:text-clay-700"
                >
                  {item.label}
                  <span className="ta ml-1.5 text-xs text-clay-500">{item.ta}</span>
                </Link>
              ))}
              <SessionLink />
            </nav>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer className="mt-16 border-t border-clay-100 bg-paper-raised">
          <div className="mx-auto max-w-6xl space-y-3 px-4 py-8 text-sm text-ink-soft">
            <p className="ta font-semibold text-ink">தொண்மை</p>
            <p className="max-w-2xl">
              Thonmai tells you which schemes you appear to qualify for. It is a
              guide, not an official system, and it never submits an application for
              you. Always confirm on the government portal before you apply.
            </p>
            <p className="text-xs">
              No Aadhaar number is ever requested. We do not log into government
              portals on your behalf.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
