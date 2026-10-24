import Link from "next/link";
import { getT } from "@/lib/i18n";

export default function Home() {
  const t = getT();
  const cards = [
    { href: "/kundli/new", icon: "☉", title: t("home.kundliTitle"), text: t("home.kundliText") },
    { href: "/milan/new", icon: "♥", title: t("home.milanTitle"), text: t("home.milanText") },
    { href: "/manglik/new", icon: "♂", title: t("home.manglikTitle"), text: t("home.manglikText") },
  ];
  return (
    <div>
      <section className="mb-6 pt-2 text-center">
        <h1 className="text-3xl font-extrabold text-brand-strong">{t("app.name")}</h1>
        <p className="mt-2 text-muted">{t("app.tagline")}</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card flex items-start gap-4 transition hover:border-brand sm:flex-col">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-2xl text-white" aria-hidden>
              {c.icon}
            </span>
            <span>
              <span className="block text-lg font-bold">{c.title}</span>
              <span className="mt-1 block text-sm text-muted">{c.text}</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Standard Parashari Jyotish · Lahiri ayanamsa · North Indian charts. Calculations by{" "}
        <a href="https://kundlit.com" className="underline" target="_blank" rel="noopener noreferrer">
          Kundlit
        </a>
        .
      </p>
    </div>
  );
}
