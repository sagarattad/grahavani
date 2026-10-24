"use client";
import { useState, type ReactNode } from "react";

export function Tabs({ tabs }: { tabs: { id: string; label: ReactNode; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div>
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-background p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${
              active === t.id ? "bg-surface text-brand shadow" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
