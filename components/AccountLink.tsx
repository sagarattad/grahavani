import Link from "next/link";
import { getT } from "@/lib/i18n";
import { auth, googleConfigured, signIn, signOut } from "@/auth";

export async function AccountLink() {
  if (!googleConfigured) return null;
  const session = await auth();
  const t = getT("nav");
  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button className="text-sm font-semibold text-brand underline">{t("login")}</button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/my" className="font-semibold text-brand underline">
        {t("myCharts")}
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="text-muted underline">{t("logout")}</button>
      </form>
    </div>
  );
}
