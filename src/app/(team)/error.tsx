"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Noe gikk galt</h1>
      <p className="muted">Vi kunne ikke hente innholdet. Prøv igjen om et øyeblikk.</p>
      <button className="button" onClick={reset}>
        Prøv igjen
      </button>
    </div>
  );
}
