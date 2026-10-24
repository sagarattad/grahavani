import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

// Draft privacy policy (India DPDP Act, 2023). Have it reviewed before launch,
// and fill in the contact email.
export default function Privacy() {
  return (
    <article className="card space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold">Privacy policy</h1>
      <p className="text-muted">Last updated: October 2026</p>

      <h2 className="h2">What we collect</h2>
      <p>
        When you make a Kundli, Gun Milan or Manglik check, we store the name, gender, birth date, birth time and birth
        place you enter, and the calculated results. If you log in with Google, we store your Google account id, name
        and email so we can show “My charts”. We store a one-way hash of your IP address (never the address itself) to
        apply daily limits.
      </p>

      <h2 className="h2">Who we share it with</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Kundlit (kundlit.com)</strong> calculates the charts. We send the birth date, time, place coordinates
          and timezone (and gender for Gun Milan). We do not send names.
        </li>
        <li>
          <strong>OpenAI</strong> writes the plain-language readings when you click “Get reading” or ask a question. We
          send only the calculated facts (Rashis, Bhavas, Dasha periods, koot scores), never names, places or birth
          details, and ask OpenAI not to store the request.
        </li>
        <li>
          <strong>Open-Meteo</strong> receives the place name you type, to find matching places.
        </li>
        <li>
          <strong>Cloudflare Turnstile</strong> checks that forms are sent by a person, not a bot.
        </li>
        <li>
          <strong>Google</strong>, only if you choose to log in.
        </li>
        <li>Our hosting providers Vercel (website) and Supabase (database) process this data on our behalf.</li>
      </ul>

      <h2 className="h2">Share links</h2>
      <p>
        Each result has a long, unguessable link. Anyone with the link can view it, so share it only with people you
        trust. Result pages are hidden from search engines. A downloaded PDF also contains the birth details, and it
        stays on the device it was saved to even after the link is deleted.
      </p>

      <h2 className="h2">How long we keep it</h2>
      <p>
        Charts and matches made without logging in are deleted automatically if nobody opens them for 12 months. Saved
        items stay until you delete them.
      </p>

      <h2 className="h2">Your rights</h2>
      <p>
        Every result page has a <strong>Delete</strong> button that removes it immediately. For any other request
        (access, correction, deletion of your account), contact us at <strong>[contact email]</strong>.
      </p>

      <h2 className="h2">Children</h2>
      <p>Please do not enter details of children under 18 without a parent or guardian’s consent.</p>
    </article>
  );
}
