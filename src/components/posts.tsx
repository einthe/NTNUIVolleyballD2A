/* eslint-disable @next/next/no-img-element -- Private authenticated media must bypass shared optimizer caches. */
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ImagePlus, Pencil, ShieldCheck } from "lucide-react";
import {
  baseRoles,
  roleTone,
  secondaryRoles,
  type Post,
  type Profile,
  type SecondaryRole,
} from "@/lib/domain";
import { dateLabel } from "@/lib/dates";
import { getLineupById } from "@/server/queries";
import { Avatar, Badge } from "./ui";
import { Court } from "./court";
import { ActionForm, DeleteButton, Submit } from "./forms";
import { ImageUpload } from "./image-upload";
export async function PostCard({
  post,
  profile,
  detail = false,
}: {
  post: Post;
  profile: Profile;
  detail?: boolean;
}) {
  const lineup = post.lineup_id ? await getLineupById(post.lineup_id) : null;
  const revision = lineup?.lineup_revisions.find((r) => r.is_current_published);
  const editable =
    profile.base_role === "admin" ||
    (post.post_type === "normal" && profile.id === post.author_user_id);
  const Heading = detail ? "h1" : "h2";
  return (
    <article
      className={`post-card card ${post.post_type === "lineup" ? "lineup-post" : ""} ${post.secondary_role_context_key ? "role-post" : ""}`}
    >
      <header className="post-header">
        <Avatar name={post.author_name_snapshot} />
        <div className="post-author">
          <strong>{post.author_name_snapshot}</strong>
          <span>
            {baseRoles[post.base_role_snapshot]} <span className="dot-separator">·</span>{" "}
            <time dateTime={post.created_at}>
              {dateLabel(post.created_at, "d. MMM 'kl.' HH:mm")}
            </time>
            {post.edited_at && <span> · Redigert</span>}
          </span>
        </div>
        {post.secondary_role_context_key && (
          <Badge tone={roleTone[post.secondary_role_context_key]}>
            <ShieldCheck size={12} />
            {post.secondary_role_context_label_snapshot}
          </Badge>
        )}
        {post.post_type === "lineup" && <Badge>Kampoppstilling</Badge>}
      </header>
      <div className="post-content">
        <Heading>
          {detail ? (
            post.title
          ) : (
            <Link href={`/posts/${post.id}`}>
              {post.post_type === "lineup" && lineup
                ? `Klare for ${lineup.schedule_events.match_details?.opponent ?? "kamp"}`
                : post.title}
            </Link>
          )}
        </Heading>
        {post.body && <p className="post-body">{post.body}</p>}
        {lineup && revision && (
          <>
            <p className="lineup-match-meta">
              <CalendarDays size={15} /> {dateLabel(lineup.schedule_events.starts_at)}{" "}
              <span>·</span> {lineup.schedule_events.location}
            </p>
            <Court slots={revision.lineup_revision_slots} compact />
            <Link className="inline-link" href={`/schedule/${lineup.match_event_id}`}>
              Se kampen <ArrowUpRight size={15} />
            </Link>
          </>
        )}
        {post.post_media.map((media) => (
          <div className="post-image-wrap" key={media.id}>
            {/* Private authenticated endpoint; bypass public image optimization caches. */}
            <img
              className="post-image"
              src={`/media/${media.id}`}
              alt={media.alt_text || `Bilde til innlegget ${post.title}`}
              loading="lazy"
            />
            {detail && editable && (
              <DeleteButton action="remove-media" id={media.id} label="Fjern bilde" />
            )}
          </div>
        ))}
      </div>
      <footer className="post-footer">
        <span>
          {post.post_type === "lineup" ? "Laget er satt. Vi ses på banen." : "Delt med laget"}
        </span>
        {editable && post.post_type === "normal" ? (
          <Link href={`/posts/${post.id}/edit`}>
            <Pencil size={14} /> Rediger
          </Link>
        ) : (
          <Link href={`/posts/${post.id}`}>
            Se innlegg <ArrowUpRight size={14} />
          </Link>
        )}
      </footer>
      {detail && editable && (
        <div className="post-delete">
          <DeleteButton action="delete-post" id={post.id} label="Slett innlegg" />
        </div>
      )}
    </article>
  );
}
export function PostForm({ post, roles }: { post?: Post; roles: SecondaryRole[] }) {
  return (
    <ActionForm className="card editor form-stack">
      <input type="hidden" name="action" value="post" />
      {post && (
        <>
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="expected_updated_at" value={post.updated_at} />
        </>
      )}
      <label>
        Tittel
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={post?.title}
          placeholder="Hva vil du dele med laget?"
        />
      </label>
      <label>
        Innlegg
        <textarea
          name="body"
          required
          maxLength={10000}
          rows={8}
          defaultValue={post?.body}
          placeholder="Skriv innlegget ditt her …"
        />
      </label>
      {!post && roles.length > 0 && (
        <label>
          Publiser som
          <select name="role_context">
            <option value="">Vanlig innlegg</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {secondaryRoles[r]}
              </option>
            ))}
          </select>
          <small className="muted">
            Ansvarsrollen vises på innlegget, også hvis rollen din endres senere.
          </small>
        </label>
      )}
      {!post?.post_media.length && (
        <fieldset className="upload-field">
          <legend>
            <ImagePlus size={18} /> Legg ved bilde <span className="muted">(valgfritt)</span>
          </legend>
          <ImageUpload
            maxMB={Math.min(10, Math.max(1, Number(process.env.MAX_IMAGE_SIZE_MB) || 3))}
          />
          <label>
            Beskriv bildet
            <input
              name="alt_text"
              maxLength={300}
              placeholder="Kort beskrivelse for dem som ikke kan se bildet"
            />
          </label>
        </fieldset>
      )}
      <div className="editor-footer">
        <span className="muted">Synlig for alle godkjente medlemmer.</span>
        <Submit>{post ? "Lagre endringer" : "Publiser innlegg"}</Submit>
      </div>
    </ActionForm>
  );
}
