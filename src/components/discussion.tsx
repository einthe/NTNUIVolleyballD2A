"use client";
import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys, queries } from "@/lib/cache/queries";
import { commentThreads, type CommentThread, type DiscussionTarget } from "@/lib/discussions";
import { updateDiscussion } from "@/server/discussion-actions";
import { dateLabel } from "@/lib/dates";
import { useTeam } from "./team-provider";
import { QueryState } from "./query-state";
import { LinkedText } from "./linked-text";
import { Avatar } from "./avatar";
import { GiphyReactions } from "./giphy-reactions";

type Save = (
  action: "comment" | "delete" | "reaction",
  data: Record<string, unknown>,
) => Promise<{ error?: string }>;
export function Discussion({ target }: { target: DiscussionTarget }) {
  const { scope, profile } = useTeam();
  const client = useQueryClient();
  const options = queries.discussion(scope, target);
  const query = useQuery(options);
  const [reactionBusy, setReactionBusy] = useState(false);
  const reactionLock = useRef(false);
  const [reactionError, setReactionError] = useState<string>();
  const [visible, setVisible] = useState(20);
  const save: Save = async (action, data) => {
    try {
      const result = await updateDiscussion(action, { ...data, ...target });
      if (!result.error)
        await Promise.all([
          client.invalidateQueries({ queryKey: options.queryKey }),
          client.invalidateQueries({
            queryKey: target.target_type === "post" ? keys.posts(scope) : keys.events(scope),
          }),
        ]);
      return result;
    } catch {
      return { error: "Kunne ikke lagre. Kontroller forbindelsen og prøv igjen." };
    }
  };
  return (
    <div className="card discussion" aria-label="Kommentarer og reaksjoner">
      <QueryState query={query} title="Diskusjonen kunne ikke hentes">
        {(data) => (
          <>
            <GiphyReactions
              reactions={data.reactions}
              userId={profile.id}
              busy={reactionBusy}
              reactTo={async (id, active) => {
                if (reactionLock.current) return false;
                reactionLock.current = true;
                setReactionBusy(true);
                setReactionError(undefined);
                try {
                  const result = await save("reaction", { giphy_id: id, active });
                  setReactionError(result.error);
                  return !result.error;
                } finally {
                  reactionLock.current = false;
                  setReactionBusy(false);
                }
              }}
            />
            {reactionError && (
              <p className="message error" role="alert">
                {reactionError}
              </p>
            )}
            <section className="discussion-comments" aria-labelledby="comments-title">
              <h2 id="comments-title">
                Kommentarer{" "}
                <span className="muted">
                  ({data.comments.filter((comment) => !comment.deleted_at).length})
                </span>
              </h2>
              <CommentForm
                save={save}
                label={
                  target.target_type === "post" ? "Kommenter innlegget" : "Kommenter hendelsen"
                }
              />
              {!data.comments.length && <p className="muted">Ingen kommentarer ennå.</p>}
              <ol className="comment-threads">
                {commentThreads(data.comments)
                  .slice(0, visible)
                  .map((comment) => (
                    <Comment
                      key={comment.id}
                      comment={comment}
                      save={save}
                      userId={profile.id}
                      admin={profile.base_role === "admin"}
                      targetLabel={
                        target.target_type === "post" ? "Svar til innlegget" : "Svar til hendelsen"
                      }
                    />
                  ))}
              </ol>
              {commentThreads(data.comments).length > visible && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setVisible((n) => n + 20)}
                >
                  Vis flere kommentarer
                </button>
              )}
            </section>
          </>
        )}
      </QueryState>
    </div>
  );
}
function CommentForm({
  save,
  label,
  parent,
  edit,
  onDone,
}: {
  save: Save;
  label: string;
  parent?: string;
  edit?: CommentThread;
  onDone?: () => void;
}) {
  const fieldId = useId();
  const [body, setBody] = useState(edit?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const requestId = useRef<string | null>(null);
  const lock = useRef(false);
  return (
    <form
      className="comment-form"
      aria-label={label}
      onSubmit={async (event) => {
        event.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError(undefined);
        setSaved(false);
        requestId.current ??= crypto.randomUUID();
        try {
          const result = await save("comment", {
            id: edit?.id ?? requestId.current,
            parent_id: parent ?? null,
            body,
            expected_version: edit?.version ?? null,
          });
          if (result.error) setError(result.error);
          else {
            setBody("");
            requestId.current = null;
            setSaved(true);
            onDone?.();
          }
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        value={body}
        required
        maxLength={3000}
        rows={3}
        disabled={busy}
        onChange={(event) => {
          setBody(event.target.value);
          setSaved(false);
        }}
      />
      <div className="comment-actions">
        <button type="submit" className="button" disabled={busy || !body.trim()}>
          {busy
            ? "Lagrer …"
            : edit
              ? "Lagre kommentar"
              : parent
                ? "Publiser svar"
                : "Publiser kommentar"}
        </button>
        {onDone && (
          <button type="button" className="text-button" disabled={busy} onClick={onDone}>
            Avbryt
          </button>
        )}
        <small className="muted">{body.length}/3000</small>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {saved && !onDone && (
        <p className="field-hint" role="status">
          Kommentaren er publisert.
        </p>
      )}
    </form>
  );
}
function Comment({
  comment,
  parentName,
  targetLabel,
  save,
  userId,
  admin,
}: {
  comment: CommentThread;
  parentName?: string;
  targetLabel: string;
  save: Save;
  userId: string;
  admin: boolean;
}) {
  const [mode, setMode] = useState<"reply" | "edit" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const own = comment.author_user_id === userId;
  return (
    <li className={`comment-thread ${comment.depth >= 3 ? "comment-thread-deep" : ""}`}>
      <article
        className="comment"
        id={`comment-${comment.id}`}
        aria-label={`Kommentar fra ${comment.author_name_snapshot}`}
      >
        <header className="comment-header">
          <Avatar name={comment.author_name_snapshot} />
          <div>
            <strong>
              {comment.author_name_snapshot}
              {own && <span className="muted"> · Deg</span>}
            </strong>
            <small className="muted">
              <time dateTime={comment.created_at}>{dateLabel(comment.created_at)}</time>
              {comment.version > 0 && !comment.deleted_at && " · Redigert"}
            </small>
          </div>
        </header>
        <small className="comment-context muted">
          {comment.parent_id ? (
            <a href={`#comment-${comment.parent_id}`}>Svar til {parentName}</a>
          ) : (
            targetLabel
          )}
        </small>
        {comment.deleted_at ? (
          <p className="muted">Kommentaren er slettet.</p>
        ) : (
          <>
            <p className="post-body comment-body">
              <LinkedText text={comment.body} />
            </p>
            <div className="comment-actions">
              {comment.depth < 32 && (
                <button
                  type="button"
                  className="text-button"
                  aria-expanded={mode === "reply"}
                  onClick={() => setMode(mode === "reply" ? null : "reply")}
                >
                  Svar
                </button>
              )}
              {own && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setMode(mode === "edit" ? null : "edit")}
                >
                  Rediger kommentar
                </button>
              )}
              {(own || admin) && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmDelete(true)}
                >
                  Slett kommentar
                </button>
              )}
            </div>
            {confirmDelete && (
              <div className="comment-delete">
                <p>Slette kommentaren? Svarene blir beholdt.</p>
                <div className="comment-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      setError(undefined);
                      const result = await save("delete", {
                        id: comment.id,
                        expected_version: comment.version,
                      });
                      setError(result.error);
                      setBusy(false);
                      if (!result.error) setConfirmDelete(false);
                    }}
                  >
                    Bekreft sletting
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="message error" role="alert">
                {error}
              </p>
            )}
            {mode && (
              <CommentForm
                key={`${mode}-${comment.version}`}
                save={save}
                label={
                  mode === "edit"
                    ? "Rediger kommentaren"
                    : `Svar til ${comment.author_name_snapshot}`
                }
                parent={mode === "reply" ? comment.id : undefined}
                edit={mode === "edit" ? comment : undefined}
                onDone={() => setMode(null)}
              />
            )}
          </>
        )}
      </article>
      {!!comment.replies.length && (
        <ol className="comment-replies">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              parentName={comment.author_name_snapshot}
              targetLabel={targetLabel}
              save={save}
              userId={userId}
              admin={admin}
            />
          ))}
        </ol>
      )}
    </li>
  );
}
