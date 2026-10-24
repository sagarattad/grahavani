import "server-only";
import { auth } from "@/auth";

/**
 * Anyone with an anonymous link may change or delete it (the link is the key).
 * Once saved to an account, only that account may.
 */
export async function canModify(ownerId: string | null): Promise<boolean> {
  if (!ownerId) return true;
  const session = await auth();
  return session?.user?.id === ownerId;
}
