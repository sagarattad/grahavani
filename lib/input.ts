import { z } from "zod";

export const placeInput = z.object({
  id: z.string().nullish(), // places.id when picked from search
  label: z.string().min(2).max(200),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(3).max(64),
});

export const personInput = z.object({
  name: z.string().trim().min(1, "Please enter a name").max(80),
  gender: z.enum(["male", "female"]),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => {
      const y = Number(d.slice(0, 4));
      return y >= 1200 && y <= 2400 && !Number.isNaN(Date.parse(d));
    }, "Please enter a real date"),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)"),
  place: placeInput,
});

export type PersonInput = z.infer<typeof personInput>;

export const toBirth = (p: PersonInput) => ({
  birth_date: p.birthDate,
  birth_time: p.birthTime,
  latitude: p.place.lat,
  longitude: p.place.lon,
  timezone: p.place.timezone,
});
