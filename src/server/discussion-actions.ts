"use server";
import { z } from "zod";
import { commentSchema, deleteCommentSchema, reactionSchema } from "@/lib/discussions";
import { requireAccount } from "@/server/queries";
import { createClient } from "@/lib/supabase/server";

export async function updateDiscussion(
  action: "comment" | "delete" | "reaction",
  input: unknown,
): Promise<{ error?: string }> {
  await requireAccount();
  try {
    const data =
      action === "comment"
        ? commentSchema.parse(input)
        : action === "delete"
          ? deleteCommentSchema.parse(input)
          : action === "reaction"
            ? reactionSchema.parse(input)
            : null;
    if (!data) return { error: "Ugyldig handling." };
    const db = await createClient();
    const result = await db.rpc(
      action === "comment"
        ? "save_comment"
        : action === "delete"
          ? "delete_comment"
          : "set_meme_reaction",
      { data },
    );
    if (result.error) {
      if (result.error.message.includes("stale_"))
        return { error: "Kommentaren ble endret. Oppdater siden før du prøver igjen." };
      if (result.error.message.includes("not_authorized"))
        return { error: "Du har ikke tilgang til denne handlingen." };
      if (result.error.message.includes("thread_too_deep"))
        return { error: "Svar på en tidligere kommentar i tråden." };
      return { error: "Kunne ikke lagre. Prøv igjen." };
    }
    return {};
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError ? error.issues[0].message : "Kunne ikke lagre. Prøv igjen.",
    };
  }
}
