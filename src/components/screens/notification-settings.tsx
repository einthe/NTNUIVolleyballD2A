"use client";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/cache/queries";
import { useTeam } from "@/components/team-provider";
import { QueryState } from "@/components/query-state";
import { notificationTriggers } from "@/lib/domain";
import type { NotificationSettings as Settings, NotificationRule } from "@/lib/cache/contract";
import { PageHeading } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";

const groups = [
  {
    title: "Innlegg",
    description:
      "Godkjente medlemmer varsles, unntatt den som publiserer. Velg verv ved publisering for å varsle som ansvarsrolle.",
    keys: Object.keys(notificationTriggers).filter(
      (k) =>
        k.startsWith("post_by_") ||
        ["normal_post_created", "role_context_post_created", "lineup_published"].includes(k),
    ),
  },
  {
    title: "Hendelser",
    description:
      "Godkjente medlemmer varsles, unntatt den som oppretter hendelsen. Verv følger hendelsestypen; trenerens hendelser følger trenerregelen. Type- og roleregler kan kombineres.",
    keys: Object.keys(notificationTriggers).filter(
      (k) =>
        k.startsWith("event_by_") ||
        [
          "match_created",
          "match_updated",
          "practice_created",
          "practice_updated",
          "social_event_created",
          "travel_event_created",
          "team_logistics_event_created",
          "finance_event_created",
          "volunteer_event_created",
          "other_event_created",
        ].includes(k),
    ),
  },
  {
    title: "Kommentarer og reaksjoner",
    description:
      "Kommentarer og reaksjoner varsler forfatteren av innlegget eller hendelsen. Svar varsler den du svarer. Egne handlinger gir ikke varsel.",
    keys: [
      "post_comment_created",
      "event_comment_created",
      "comment_reply_created",
      "post_reaction_created",
      "event_reaction_created",
    ],
  },
  {
    title: "Personlige varsler",
    description: "Sendes bare til personen det gjelder.",
    keys: ["volunteer_assignment_created", "fine_received", "volunteer_points_changed"],
  },
];
export default function NotificationSettings() {
  const { scope, profile } = useTeam();
  const query = useQuery({
    ...queries.rules(scope),
    enabled: profile.base_role === "admin",
    refetchInterval: 15000,
  });
  return (
    <QueryState query={query} title="Innstillingene kunne ikke hentes">
      {(data) => <SettingsView data={data} />}
    </QueryState>
  );
}
function Rule({ rule }: { rule: NotificationRule }) {
  const label = notificationTriggers[rule.trigger_key as keyof typeof notificationTriggers];
  return (
    <ActionForm className="notification-rule">
      <input type="hidden" name="action" value="notification-rule" />
      <input type="hidden" name="trigger_key" value={rule.trigger_key} />
      <strong>{label}</strong>
      <label className="toggle-label">
        <input
          type="checkbox"
          role="switch"
          name="enabled"
          key={`app-${rule.enabled}`}
          aria-label={`${label} – I appen`}
          defaultChecked={rule.enabled}
        />
        <span>I appen</span>
      </label>
      <label className="toggle-label">
        <input
          type="checkbox"
          role="switch"
          name="email_enabled"
          key={`email-${rule.email_enabled}`}
          aria-label={`${label} – E-post`}
          defaultChecked={rule.email_enabled}
        />
        <span>E-post</span>
      </label>
      <Submit secondary>Lagre</Submit>
    </ActionForm>
  );
}
function SettingsView({ data }: { data: Settings }) {
  return (
    <>
      <PageHeading
        title="Varselinnstillinger"
        description="Velg hvilke aktiviteter som varsles i appen og på e-post."
      />
      <p className="message info">
        Innstillingene gjelder nye aktiviteter. Flere regler kan gjelde samme aktivitet; mottakeren
        får maksimalt ett varsel per kanal. E-post er avslått for alle regler fra start.
      </p>
      <section className="card notification-delivery" aria-label="E-postlevering">
        <h2>E-postlevering</h2>
        <p>
          {data.delivery.mode === "preview"
            ? "Lokal demo: e-poster forhåndsvises her og sendes ikke."
            : data.delivery.configured
              ? "Resend er konfigurert."
              : "E-postlevering er ikke aktivert eller ferdig konfigurert."}
        </p>
        {!data.delivery.configured && (
          <p className="muted">
            Sett NOTIFICATION_EMAIL_MODE=resend på serveren.
            {data.delivery.missing.length > 0 && ` Mangler: ${data.delivery.missing.join(", ")}.`}
          </p>
        )}
        <p className="muted">
          I kø: {data.queue.pending} ·{" "}
          {data.delivery.mode === "preview" ? "Forhåndsvist" : "Sendt til Resend"}:{" "}
          {data.queue.sent} · Feilet: {data.queue.failed}
        </p>
        {data.queue.failed > 0 && (
          <p className="message error">
            Noen e-poster kunne ikke sendes. Kontroller Resend og serveroppsettet.
          </p>
        )}
        {data.queue.recent.length > 0 && (
          <details>
            <summary>Siste e-postvarsler</summary>
            {data.queue.recent.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <p>
                  {item.full_name} ·{" "}
                  {
                    (
                      {
                        pending: "I kø",
                        sending: "Behandles",
                        sent:
                          data.delivery.mode === "preview" ? "Forhåndsvist" : "Sendt til Resend",
                        cancelled: "Avbrutt",
                        failed: "Feilet",
                      } as Record<string, string>
                    )[item.status]
                  }
                </p>
                <p className="muted">{item.body}</p>
              </article>
            ))}
          </details>
        )}
      </section>
      {groups.map((group) => (
        <section className="card notification-settings" key={group.title}>
          <h2>{group.title}</h2>
          <p className="muted">{group.description}</p>
          {group.keys.map((key) => {
            const rule = data.rules.find((r) => r.trigger_key === key);
            return rule ? <Rule key={key} rule={rule} /> : null;
          })}
        </section>
      ))}
    </>
  );
}
