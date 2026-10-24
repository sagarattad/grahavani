"use client";
import { useEffect, useRef, useState } from "react";
import { getT } from "@/lib/i18n";

export type PickedPlace = { id?: string | null; label: string; lat: number; lon: number; timezone: string };
type Option = PickedPlace & { id: string; admin2: string | null };

/** Place search (Open-Meteo via our /api/places). The user must pick from the list. */
export function PlaceField({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  value: PickedPlace | null;
  onChange: (p: PickedPlace | null) => void;
  autoFocus?: boolean;
}) {
  const t = getT("form");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value || query.trim().length < 2) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setOptions(data.results ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query, value]);

  if (value) {
    return (
      <div className="rounded-xl border border-good/40 bg-good-bg px-3 py-2 text-sm">
        <p>
          📍 <span className="font-semibold">{value.label}</span>
        </p>
        <p className="text-muted">
          {value.lat.toFixed(2)}, {value.lon.toFixed(2)}
        </p>
        <button
          type="button"
          className="mt-1 font-semibold text-brand underline"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          {t("wrongPlace")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={id}
        className="field"
        placeholder={t("placeHint")}
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => options.length && setOpen(true)}
        role="combobox"
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {loading && <p className="help">{t("placeSearching")}</p>}
      {open && !loading && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg">
          {options.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("placeNone")}</li>}
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="block min-h-11 w-full px-3 py-2 text-left hover:bg-background"
                onClick={() => {
                  onChange({ id: o.id, label: o.label, lat: o.lat, lon: o.lon, timezone: o.timezone });
                  setOpen(false);
                }}
              >
                <span className="font-semibold">{o.label}</span>
                {o.admin2 && <span className="block text-xs text-muted">{o.admin2}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
