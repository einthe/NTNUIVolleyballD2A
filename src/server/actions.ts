"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/server/queries";
import {
  eventSchema,
  imageSchema,
  lineupSchema,
  notificationSchema,
  positionSchema,
  postSchema,
  userSchema,
  uuid,
} from "@/lib/domain";
import { toUTC } from "@/lib/dates";
import type { ActionState } from "./auth-actions";

function friendlyError(message: string) {
  if (message.includes("stale_"))
    return "Innholdet ble endret av noen andre. Last siden på nytt før du lagrer.";
  if (message.includes("jersey_number"))
    return "Draktnummeret er allerede i bruk. Velg et annet nummer.";
  if (message.includes("lineup_history_exists"))
    return "Kampen har en lagret oppstilling og må bevares. Oppdater kampbeskrivelsen ved avlysning.";
  if (message.includes("not_authorized") || message.includes("invalid_role"))
    return "Du har ikke tilgang til denne handlingen. Last siden på nytt for å oppdatere tilgangene dine.";
  if (message.includes("six_starters")) return "Velg seks forskjellige spillere før publisering.";
  if (message.includes("invalid_player"))
    return "En valgt spiller er ikke lenger tilgjengelig. Last siden på nytt.";
  return "Kunne ikke lagre endringen. Kontroller feltene og prøv igjen.";
}
export async function mutate(_state: ActionState, form: FormData): Promise<ActionState> {
  const profile = await requireAccount();
  const db = await createClient();
  const kind = String(form.get("action"));
  const text = (key: string) => String(form.get(key) ?? "");
  const nullable = (key: string) => text(key) || null;
  const number = (key: string) => (text(key) === "" ? null : Number(text(key)));
  let destination: string | undefined;
  try {
    const rpc = async (name: string, data: Record<string, unknown>) => {
      const result = await db.rpc(name, data);
      if (result.error) throw new Error(result.error.message);
      return result.data as string;
    };
    if (kind === "post") {
      const input = postSchema.parse({
        id: text("id") || undefined,
        title: text("title"),
        body: text("body"),
        role_context: nullable("role_context"),
        expected_updated_at: text("expected_updated_at") || undefined,
      });
      const file = form.get("image");
      let image: { buffer: Buffer; mime: string; extension: string } | undefined;
      if (file instanceof File && file.size) {
        imageSchema.parse({ type: file.type, size: file.size });
        const maxSize =
          Math.min(10, Math.max(1, Number(process.env.MAX_IMAGE_SIZE_MB) || 3)) * 1024 * 1024;
        if (file.size > maxSize)
          return {
            error: `Bildet er for stort. Maksimal størrelse er ${maxSize / 1024 / 1024} MB.`,
          };
        const source = Buffer.from(await file.arrayBuffer());
        const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
          return { error: "Velg et gyldig JPEG-, PNG- eller WebP-bilde." };
        const buffer = await sharp(source, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        image = { buffer, mime: "image/webp", extension: "webp" };
      }
      const alt = z.string().max(300).parse(text("alt_text"));
      const id = await rpc("save_post", { data: input });
      if (image) {
        const path = `${profile.id}/${crypto.randomUUID()}.${image.extension}`;
        const uploaded = await db.storage
          .from("post-images")
          .upload(path, image.buffer, { contentType: image.mime, upsert: false });
        if (uploaded.error) {
          revalidatePath("/", "layout");
          return {
            error:
              "Innlegget ble lagret, men bildet kunne ikke lastes opp. Åpne innlegget fra feeden for å prøve bildet på nytt.",
          };
        }
        try {
          await rpc("attach_media", {
            data: {
              post_id: id,
              storage_path: path,
              mime_type: image.mime,
              size_bytes: image.buffer.length,
              alt_text: alt,
            },
          });
        } catch {
          await db.storage.from("post-images").remove([path]);
          revalidatePath("/", "layout");
          return {
            error:
              "Innlegget ble lagret, men bildet kunne ikke knyttes til det. Åpne innlegget fra feeden for å prøve igjen.",
          };
        }
      }
      destination = `/posts/${id}`;
    } else if (kind === "event") {
      const input = eventSchema.parse({
        id: text("id") || undefined,
        event_type: text("event_type"),
        title: text("title"),
        description: nullable("description"),
        starts_at: toUTC(text("starts_at")),
        ends_at: text("ends_at") ? toUTC(text("ends_at")) : null,
        location: nullable("location"),
        opponent: nullable("opponent"),
        home_away: text("home_away") || "home",
        team_sets: number("team_sets"),
        opponent_sets: number("opponent_sets"),
        assignments: form.getAll("assignments"),
        expected_updated_at: text("expected_updated_at") || undefined,
      });
      destination = `/schedule/${await rpc("save_event", { data: input })}`;
    } else if (kind === "lineup") {
      const slots = Array.from({ length: 6 }, (_, i) => ({
        player_user_id: text(`slot_${i + 1}`),
        court_position: i + 1,
        is_libero: false,
      })).filter((s) => s.player_user_id);
      const input = lineupSchema.parse({
        match_id: text("match_id"),
        expected_revision: Number(text("expected_revision")),
        publish: text("intent") === "publish",
        slots: [
          ...slots,
          ...(text("libero")
            ? [{ player_user_id: text("libero"), court_position: null, is_libero: true }]
            : []),
        ],
      });
      await rpc("save_lineup", { data: input });
      destination = `/schedule/${input.match_id}`;
    } else if (kind === "user") {
      const input = userSchema.parse({
        id: text("id"),
        full_name: text("full_name"),
        base_role: text("base_role"),
        account_status: text("account_status"),
        jersey_number: number("jersey_number"),
        roles: form.getAll("roles"),
      });
      await rpc("manage_user", { data: input });
    } else if (kind === "positions") {
      await rpc("set_positions", {
        data: positionSchema.parse({
          id: text("id"),
          primary: nullable("primary"),
          secondary: form.getAll("secondary"),
        }),
      });
    } else if (kind === "notification-rule") {
      await rpc("set_notification_rule", {
        data: notificationSchema.parse({
          trigger_key: text("trigger_key"),
          enabled: text("enabled") === "on",
        }),
      });
    } else if (kind === "read-notification") {
      await rpc("mark_notification_read", { target: uuid.parse(text("id")) });
    } else if (kind === "delete-post") {
      const id = uuid.parse(text("id"));
      const { data: media } = await db.from("post_media").select("storage_path").eq("post_id", id);
      await rpc("delete_post", { target: id });
      if (media?.length)
        await db.storage.from("post-images").remove(media.map((m) => m.storage_path));
      destination = "/feed";
    } else if (kind === "delete-event") {
      await rpc("delete_event", { target: uuid.parse(text("id")) });
      destination = "/schedule";
    } else if (kind === "remove-media") {
      const path = await rpc("remove_media", { target: uuid.parse(text("id")) });
      await db.storage.from("post-images").remove([path]);
    } else return { error: "Ukjent handling." };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0].message };
    if (error instanceof Error && error.message.includes("sommertid"))
      return { error: error.message };
    return { error: friendlyError(error instanceof Error ? error.message : "") };
  }
  revalidatePath("/", "layout");
  if (destination) redirect(destination);
  return { success: "Endringen er lagret." };
}
