"use client";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/cache/queries";
import { useTeam } from "@/components/team-provider";
import { QueryState } from "@/components/query-state";
import { BellOff } from "lucide-react";
import { notificationTriggers } from "@/lib/domain";
import { PageHeading } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
export default function NotificationSettings() {
  const { scope, profile } = useTeam();
  const query = useQuery({ ...queries.rules(scope), enabled: profile.base_role === "admin" });
  return (
    <QueryState query={query} title="Innstillingene kunne ikke hentes">
      {(data) => <SettingsView data={data} />}
    </QueryState>
  );
}
function SettingsView({ data }: { data: import("@/lib/cache/contract").NotificationRule[] }) {
  return (
    <>
      <PageHeading
        title="Varselinnstillinger"
        description="Bestem hvilke hendelser som skal gi varsler i lagrommet."
      />
      <p className="message info">
        <BellOff size={18} /> Alle varsler er avslått fra start. Endringer gjelder fremtidige
        hendelser. Varsler sendes bare i appen.
      </p>
      <div className="card notification-settings">
        {data.map((rule) => (
          <ActionForm className="notification-rule" key={rule.trigger_key}>
            <input type="hidden" name="action" value="notification-rule" />
            <input type="hidden" name="trigger_key" value={rule.trigger_key} />
            <label className="toggle-label">
              <input type="checkbox" role="switch" name="enabled" defaultChecked={rule.enabled} />
              <span>
                {notificationTriggers[rule.trigger_key as keyof typeof notificationTriggers]}
              </span>
            </label>
            <Submit secondary>Lagre</Submit>
          </ActionForm>
        ))}
      </div>
    </>
  );
}
