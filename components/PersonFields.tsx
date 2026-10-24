"use client";
import { getT } from "@/lib/i18n";
import { PlaceField, type PickedPlace } from "./PlaceField";

export type PersonDraft = {
  name: string;
  gender: "male" | "female" | "";
  birthDate: string;
  birthTime: string;
  place: PickedPlace | null;
};

export const emptyPerson = (gender: PersonDraft["gender"] = ""): PersonDraft => ({
  name: "",
  gender,
  birthDate: "",
  birthTime: "",
  place: null,
});

export function PersonFields({
  prefix,
  value,
  onChange,
  fixedGender,
}: {
  prefix: string;
  value: PersonDraft;
  onChange: (v: PersonDraft) => void;
  fixedGender?: boolean;
}) {
  const t = getT("form");
  const set = <K extends keyof PersonDraft>(k: K, v: PersonDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor={`${prefix}-name`}>{t("name")}</label>
        <input
          id={`${prefix}-name`}
          className="field"
          value={value.name}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </div>
      {!fixedGender && (
        <fieldset>
          <legend className="label">{t("gender")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((g) => (
              <label
                key={g}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border font-semibold ${
                  value.gender === g ? "border-brand bg-brand text-white" : "border-border bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name={`${prefix}-gender`}
                  value={g}
                  className="sr-only"
                  checked={value.gender === g}
                  onChange={() => set("gender", g)}
                  required
                />
                {t(g)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`${prefix}-date`}>{t("birthDate")}</label>
          <input
            id={`${prefix}-date`}
            type="date"
            className="field"
            min="1200-01-01"
            max="2400-12-31"
            value={value.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-time`}>{t("birthTime")}</label>
          <input
            id={`${prefix}-time`}
            type="time"
            className="field"
            value={value.birthTime}
            onChange={(e) => set("birthTime", e.target.value)}
            required
          />
        </div>
      </div>
      <p className="help -mt-2">{t("birthTimeHelp")}</p>
      <div>
        <label className="label" htmlFor={`${prefix}-place`}>{t("birthPlace")}</label>
        <PlaceField id={`${prefix}-place`} value={value.place} onChange={(p) => set("place", p)} />
      </div>
    </div>
  );
}

export const personPayload = (p: PersonDraft) => ({
  name: p.name.trim(),
  gender: p.gender,
  birthDate: p.birthDate,
  birthTime: p.birthTime.slice(0, 5),
  place: p.place,
});
