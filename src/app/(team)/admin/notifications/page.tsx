import { BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/queries";
import { notificationTriggers } from "@/lib/domain";
import { PageHeading } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
export default async function NotificationSettings() {
  await requireAdmin();
  const db = await createClient();
  const { data, error } = await db
    .from("notification_rules")
    .select("trigger_key,enabled")
    .order("trigger_key");
  if (error) throw new Error("Kunne ikke hente innstillinger.");
  return (
    <>
      <PageHeading
        eyebrow="BARE DET LAGET TRENGER"
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
