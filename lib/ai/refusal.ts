// Follow-up topics the app never answers (timing or likelihood of death,
// illness, accidents, surgery, divorce/separation, childbirth/fertility,
// legal outcomes). Caught in code before any OpenAI call, so they cost nothing.

const TOPICS: { topic: string; re: RegExp }[] = [
  { topic: "death or lifespan", re: /\b(death|die|dies|dying|died|lifespan|life span|longevity|how long will i live)\b/i },
  { topic: "illness", re: /\b(illness|ill|disease|sick|sickness|cancer|tumou?r|diabetes|heart attack|stroke)\b/i },
  { topic: "accidents", re: /\b(accident|accidents|injury|injured|mishap)\b/i },
  { topic: "surgery", re: /\b(surgery|surgeries|operation|operated)\b/i },
  { topic: "divorce or separation", re: /\b(divorce|divorced|separation|separate|separated|break ?up|breakup)\b/i },
  { topic: "childbirth or fertility", re: /\b(pregnan\w*|conceive|conception|fertility|infertil\w*|childbirth|baby|babies|miscarriage|child|children|son|daughter)\b/i },
  { topic: "legal cases", re: /\b(court|lawsuit|legal case|case outcome|verdict|jail|arrest\w*|litigation)\b/i },
];

export function refusalTopic(question: string): string | null {
  return TOPICS.find((t) => t.re.test(question))?.topic ?? null;
}

export const refusalAnswer = (topic: string) =>
  `Grahavani does not answer questions about ${topic}. You can ask about personality, career, education, ` +
  `marriage timing, property, travel, Yogas, Doshas or the Dasha periods in this chart instead.`;
