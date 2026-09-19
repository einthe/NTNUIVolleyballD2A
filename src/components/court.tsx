import { positions, type Slot } from "@/lib/domain";
export function Court({ slots, compact = false }: { slots: Slot[]; compact?: boolean }) {
  const libero = slots.find((s) => s.is_libero);
  return (
    <div className={`lineup-visual ${compact ? "compact" : ""} ${libero ? "with-libero" : ""}`}>
      <div className="court-wrap">
        <div className="court-net">
          <span>NETT</span>
        </div>
        <div className="court" aria-hidden="true">
          {[4, 3, 2, 5, 6, 1].map((position) => {
            const slot = slots.find((s) => s.court_position === position && !s.is_libero);
            return (
              <div className="court-slot" key={position}>
                <span className="rotation-number">{position}</span>
                <div className="jersey">{slot?.jersey_number_snapshot ?? "–"}</div>
                <strong>{slot?.full_name_snapshot ?? "Ledig posisjon"}</strong>
                {slot?.primary_position_snapshot && (
                  <small>{positions[slot.primary_position_snapshot]}</small>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {libero && (
        <div className="libero-card">
          <span className="eyebrow">LIBERO</span>
          <span className="libero-number">#{libero.jersey_number_snapshot ?? "–"}</span>
          <strong>{libero.full_name_snapshot}</strong>
        </div>
      )}
      <details className="lineup-text">
        <summary>Se oppstillingen som liste</summary>
        <ol>
          {[...slots]
            .sort((a, b) => (a.court_position ?? 7) - (b.court_position ?? 7))
            .map((s) => (
              <li key={s.player_user_id}>
                {s.is_libero ? "Libero" : `Posisjon ${s.court_position}`}:{" "}
                {s.jersey_number_snapshot !== null && `#${s.jersey_number_snapshot} `}
                {s.full_name_snapshot}
              </li>
            ))}
        </ol>
      </details>
    </div>
  );
}
