"use server";
import { volunteerWorkPointsSchema } from "@/lib/volunteer-work-points";
import {
  fineTypeSchema,
  fineRulesSchema,
  applyFineSchema,
  fineMultiplierSchema,
} from "@/lib/fines";
import { z } from "zod";
import { scheduleNotificationEmails } from "./notifications/schedule";
import sharp from "sharp";
import { forgetImageVariants, warmImageVariants } from "@/server/private-images";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/server/queries";
import {
  eventSchema,
  imageSchema,
  lineupSchema,
  lineupRoles,
  courtPosition,
  type LineupRole,
  notificationSchema,
  positionSchema,
  postSchema,
  userSchema,
  uuid,
} from "@/lib/domain";
import { toUTC } from "@/lib/dates";
import type { Change } from "@/lib/cache/contract";
import type { ActionState } from "./auth-actions";

function friendlyError(message: string) {
  if (message.includes("fine_multipliers_name"))
    return "Det finnes allerede en ekstraregel med dette navnet.";
  if (message.includes("invalid_fine_multiplier"))
    return "Ekstraregelen er ikke tilgjengelig. Oppdater siden og velg på nytt.";
  if (message.includes("fine_amount_too_small")) return "Samlet bot må være minst 0,01 kr.";
  if (message.includes("fine_amount_too_large"))
    return "Samlet bot kan ikke overstige 1 000 000 kr.";
  if (message.includes("fine_types_name")) return "Det finnes allerede en bot med dette navnet.";
  if (message.includes("invalid_fine_recipient"))
    return "Bøter kan bare gis til godkjente spillere og trenere.";
  if (message.includes("invalid_fine_type"))
    return "Denne boten er ikke tilgjengelig. Oppdater siden og velg en annen.";
  if (message.includes("invalid_fine_request"))
    return "Denne registreringen er allerede brukt. Lukk skjemaet og prøv på nytt.";
  if (message.includes("stale_"))
    return "Innholdet ble endret av noen andre. Last siden på nytt før du lagrer.";
  if (message.includes("jersey_number"))
    return "Draktnummeret er allerede i bruk. Velg et annet nummer.";
  if (message.includes("lineup_history_exists"))
    return "Kampen har en lagret oppstilling og må bevares. Oppdater kampbeskrivelsen ved avlysning.";
  if (message.includes("external_event_readonly"))
    return "Denne kampen oppdateres automatisk fra VolleyballLive.";
  if (message.includes("invalid_player_position"))
    return "En valgt spiller har ikke lenger riktig spillerposisjon. Oppdater oppstillingen før du lagrer.";
  if (message.includes("not_authorized") || message.includes("invalid_role"))
    return "Du har ikke tilgang til denne handlingen. Last siden på nytt for å oppdatere tilgangene dine.";
  if (message.includes("six_starters")) return "Velg seks forskjellige spillere før publisering.";
  if (message.includes("invalid_player"))
    return "En valgt spiller er ikke lenger tilgjengelig. Last siden på nytt.";
  return "Kunne ikke lagre endringen. Kontroller feltene og prøv igjen.";
}
export async function mutate(previousState: ActionState, form: FormData): Promise<ActionState> {
  const profile = await requireAccount();
  const db = await createClient({ cache: "no-store" });
  const kind = String(form.get("action"));
  const text = (key: string) => String(form.get(key) ?? "");
  const nullable = (key: string) => text(key) || null;
  const number = (key: string) => (text(key) === "" ? null : Number(text(key)));
  let destination: string | undefined;
  const change: Change = { kind, id: text("id") || undefined };
  let savedPost: Pick<ActionState, "savedPostId" | "savedPostUpdatedAt"> =
    kind === "post"
      ? {
          savedPostId: previousState.savedPostId,
          savedPostUpdatedAt: previousState.savedPostUpdatedAt,
        }
      : {};
  try {
    const rpc = async (name: string, data: Record<string, unknown>) => {
      const result = await db.rpc(name, data);
      if (result.error) throw new Error(result.error.message);
      if (
        [
          "save_post",
          "save_event",
          "save_lineup",
          "apply_fine",
          "set_volunteer_work_points",
        ].includes(name)
      )
        scheduleNotificationEmails();
      return result.data as string;
    };
    if (kind === "fine-multiplier") {
      await rpc("save_fine_multiplier", {
        data: fineMultiplierSchema.parse({
          id: text("id") || undefined,
          name: text("name"),
          description: text("description"),
          factor: text("factor"),
          active: text("active") === "on",
          expected_version: text("expected_version"),
        }),
      });
    } else if (kind === "fine-type") {
      await rpc("save_fine_type", {
        data: fineTypeSchema.parse({
          id: text("id") || undefined,
          name: text("name"),
          description: text("description"),
          amount_ore: text("amount"),
          active: text("active") === "on",
          expected_version: text("expected_version"),
        }),
      });
    } else if (kind === "fine-rules") {
      await rpc("save_fine_rules", {
        data: fineRulesSchema.parse({
          body: text("body"),
          expected_version: text("expected_version"),
        }),
      });
    } else if (kind === "fine") {
      await rpc("apply_fine", {
        data: applyFineSchema.parse({
          id: text("id"),
          user_id: text("user_id"),
          fine_type_id: text("fine_type_id"),
          expected_type_version: text("expected_type_version"),
          multiplier_id: text("multiplier_id") || undefined,
          expected_multiplier_version: text("expected_multiplier_version") || undefined,
          note: text("note"),
        }),
      });
    } else if (kind === "cancel-fine") {
      await rpc("cancel_fine", { target: uuid.parse(text("id")) });
    } else if (kind === "image-settings") {
      if (profile.base_role !== "admin") throw new Error("not_authorized");
      const expectedVersion = z.coerce.number().int().min(0).parse(text("expected_version"));
      await rpc("set_image_settings", {
        data: {
          responsive_images: text("responsive_images") === "on",
          expected_version: expectedVersion,
        },
      });
    } else if (kind === "profile-photo" || kind === "remove-profile-photo") {
      let path: string | null = null;
      if (kind === "profile-photo") {
        const file = form.get("image");
        if (!(file instanceof File) || !file.size) return { error: "Velg et profilbilde." };
        if (file.size > 3 * 1024 * 1024) return { error: "Bildet kan være høyst 3 MB." };
        imageSchema.parse({ type: file.type, size: file.size });
        let buffer: Buffer;
        try {
          const source = Buffer.from(await file.arrayBuffer());
          const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
          if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
            throw new Error("invalid_image");
          buffer = await sharp(source, { limitInputPixels: 40_000_000 })
            .rotate()
            .resize(512, 512, { fit: "cover" })
            .webp({ quality: 85 })
            .toBuffer();
        } catch {
          return { error: "Velg et gyldig JPEG-, PNG- eller WebP-bilde." };
        }
        path = `${profile.id}/${crypto.randomUUID()}.webp`;
        const upload = await db.storage
          .from("profile-photos")
          .upload(path, buffer, { contentType: "image/webp", upsert: false });
        if (upload.error) return { error: "Bildet kunne ikke lastes opp. Prøv igjen." };
        await warmImageVariants(db, "avatar", path, buffer);
      }
      let previous: string | null;
      try {
        previous = await rpc("set_profile_photo", {
          data: { storage_path: path, expected_path: nullable("expected_path") },
        });
      } catch (error) {
        if (path) {
          await db.storage.from("profile-photos").remove([path]);
          forgetImageVariants("avatar", path);
        }
        throw error;
      }
      if (previous) {
        await db.storage.from("profile-photos").remove([previous]);
        forgetImageVariants("avatar", previous);
      }
    } else if (kind === "post") {
      const input = postSchema.parse({
        id: savedPost.savedPostId || text("id") || undefined,
        title: text("title"),
        body: text("body"),
        role_context: nullable("role_context"),
        expected_updated_at:
          savedPost.savedPostUpdatedAt || text("expected_updated_at") || undefined,
      });
      const file = form.get("image");
      let image: { buffer: Buffer; mime: string; extension: string } | undefined;
      if (file instanceof File && file.size) {
        imageSchema.parse({ type: file.type, size: file.size });
        const maxSize =
          Math.min(10, Math.max(1, Number(process.env.MAX_IMAGE_SIZE_MB) || 3)) * 1024 * 1024;
        if (file.size > maxSize)
          return {
            ...savedPost,
            change,
            error: `Bildet er for stort. Maksimal størrelse er ${maxSize / 1024 / 1024} MB.`,
          };
        const source = Buffer.from(await file.arrayBuffer());
        const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
          return { ...savedPost, error: "Velg et gyldig JPEG-, PNG- eller WebP-bilde." };
        const buffer = await sharp(source, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        image = { buffer, mime: "image/webp", extension: "webp" };
      }
      const alt = z.string().max(300).parse(text("alt_text"));
      const id = await rpc("save_post", { data: input });
      change.postId = id;
      if (image) {
        // If Storage fails after the text commits, retry this same post instead
        // of inserting a duplicate. RPC ownership and stale-edit checks still apply.
        const { data: saved } = await db.from("posts").select("updated_at").eq("id", id).single();
        savedPost = { savedPostId: id, savedPostUpdatedAt: saved?.updated_at };
        const path = `${profile.id}/${crypto.randomUUID()}.${image.extension}`;
        const uploaded = await db.storage
          .from("post-images")
          .upload(path, image.buffer, { contentType: image.mime, upsert: false });
        if (uploaded.error) {
          return {
            ...savedPost,
            change,
            error:
              "Teksten er lagret, men bildet kunne ikke lastes opp. Prøv igjen, eller åpne det lagrede innlegget.",
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
          await warmImageVariants(db, "post", path, image.buffer);
        } catch {
          await db.storage.from("post-images").remove([path]);
          return {
            ...savedPost,
            change,
            error:
              "Innlegget ble lagret, men bildet kunne ikke knyttes til det. Åpne innlegget fra feeden for å prøve igjen.",
          };
        }
      }
      destination = `/posts/${id}`;
    } else if (kind === "volunteer_work_points") {
      change.id = await rpc("set_volunteer_work_points", {
        data: volunteerWorkPointsSchema.parse({
          id: text("id"),
          points: number("points"),
          expected_version: number("expected_version"),
        }),
      });
    } else if (kind === "match-title") {
      const input = z
        .object({
          id: uuid,
          title: z.string().trim().min(1).max(160),
          expected_updated_at: z.string().datetime({ offset: true }),
        })
        .parse({
          id: text("id"),
          title: text("title"),
          expected_updated_at: text("expected_updated_at"),
        });
      change.kind = "event";
      change.id = await rpc("set_imported_match_title", { data: input });
      destination = `/schedule/${change.id}`;
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
        home_away: "neutral",
        team_sets: number("team_sets"),
        opponent_sets: number("opponent_sets"),
        assignments: form.getAll("assignments"),
        expected_updated_at: text("expected_updated_at") || undefined,
      });
      change.id = await rpc("save_event", { data: input });
      destination = `/schedule/${change.id}`;
    } else if (kind === "lineup") {
      const setterPosition = Number(text("setter_position"));
      const input = lineupSchema.parse({
        match_id: text("match_id"),
        setter_position: setterPosition,
        expected_revision: Number(text("expected_revision")),
        publish: text("intent") === "publish",
        slots: (Object.keys(lineupRoles) as LineupRole[])
          .map((role) => ({
            player_user_id: text(`role_${role}`),
            lineup_role: role,
            court_position: courtPosition(role, setterPosition),
            is_libero: role === "libero",
          }))
          .filter((slot) => slot.player_user_id),
      });
      await rpc("save_lineup", { data: input });
      change.matchId = input.match_id;
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
          email_enabled: text("email_enabled") === "on",
        }),
      });
    } else if (kind === "read-notification") {
      await rpc("mark_notification_read", { target: uuid.parse(text("id")) });
    } else if (kind === "delete-post") {
      const id = uuid.parse(text("id"));
      const { data: media } = await db.from("post_media").select("storage_path").eq("post_id", id);
      await rpc("delete_post", { target: id });
      change.postId = id;
      if (media?.length) {
        await db.storage.from("post-images").remove(media.map((m) => m.storage_path));
        media.forEach((item) => forgetImageVariants("post", item.storage_path));
      }
      destination = "/feed";
    } else if (kind === "delete-event") {
      await rpc("delete_event", { target: uuid.parse(text("id")) });
      destination = "/schedule";
    } else if (kind === "remove-media") {
      const mediaId = uuid.parse(text("id"));
      const media = await db.from("post_media").select("post_id").eq("id", mediaId).single();
      if (media.error) throw new Error(media.error.message);
      change.postId = media.data.post_id;
      const path = await rpc("remove_media", { target: mediaId });
      await db.storage.from("post-images").remove([path]);
      forgetImageVariants("post", path);
    } else return { error: "Ukjent handling." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ...savedPost, error: error.issues[0].message };
    if (error instanceof Error && error.message.includes("sommertid"))
      return { error: error.message };
    return { ...savedPost, error: friendlyError(error instanceof Error ? error.message : "") };
  }
  return { success: "Endringen er lagret.", destination, change };
}
