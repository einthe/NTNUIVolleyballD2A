"use client";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, LoaderCircle } from "lucide-react";
import { mutate } from "@/server/actions";
import { authAction, type ActionState } from "@/server/auth-actions";
import Link from "next/link";
export function Submit({
  children = "Lagre endringer",
  secondary = false,
  name,
  value,
}: {
  children?: ReactNode;
  secondary?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`button ${secondary ? "secondary" : ""}`}
      disabled={pending}
      name={name}
      value={value}
    >
      {pending ? (
        <>
          <LoaderCircle size={17} className="spin" /> Lagrer …
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function ActionForm({
  children,
  className,
  auth = false,
}: {
  children: ReactNode;
  className?: string;
  auth?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(auth ? authAction : mutate, {});
  return (
    <form action={action} className={className ?? "form-stack"}>
      {children}
      {state.error && (
        <p className="message error" role="alert">
          {state.error}
        </p>
      )}
      {state.savedPostId && (
        <Link className="inline-link" href={`/posts/${state.savedPostId}/edit`}>
          Åpne det lagrede innlegget
        </Link>
      )}
      {state.success && (
        <p className="message success" role="status">
          <Check size={16} /> {state.success}
        </p>
      )}
    </form>
  );
}
export function DeleteButton({
  action,
  id,
  label,
  message,
}: {
  action: string;
  id: string;
  label: string;
  message?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm)
    return (
      <button type="button" className="text-button danger" onClick={() => setConfirm(true)}>
        {label}
      </button>
    );
  return (
    <div className="confirm-delete">
      <p>{message ?? "Vil du slette dette? Handlingen kan ikke angres."}</p>
      <ActionForm>
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="id" value={id} />
        <div className="button-row">
          <Submit>Ja, {label.toLowerCase()}</Submit>
          <button type="button" className="button secondary" onClick={() => setConfirm(false)}>
            Avbryt
          </button>
        </div>
      </ActionForm>
    </div>
  );
}
