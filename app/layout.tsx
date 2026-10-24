import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/lib/i18n";
import { AccountLink } from "@/components/AccountLink";
import "./globals.css";

const noto = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Grahavani — Kundli, Gun Milan & Manglik Dosha", template: "%s · Grahavani" },
  description: "Free Vedic astrology: Kundli with Lagna and Navamsa charts, Ashtakoot Gun Milan, and Manglik Dosha check, explained in plain language.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#9a3412", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const t = getT();
  return (
    <html lang="en" className={`${noto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
              <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">
                ✦ {t("app.name")}
              </Link>
              <Suspense fallback={null}>
                <AccountLink />
              </Suspense>
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted">
            <p className="mx-auto max-w-xl">{t("app.disclaimer")}</p>
            <nav className="mt-3 flex justify-center gap-5">
              <Link href="/about" className="underline">{t("nav.about")}</Link>
              <Link href="/privacy" className="underline">{t("nav.privacy")}</Link>
            </nav>
          </footer>
      </body>
    </html>
  );
}
