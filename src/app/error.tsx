"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone-message">
      <p className="eyebrow">EN LITEN PAUSE</p>
      <h1>Vi fikk ikke kontakt med lagrommet.</h1>
      <p className="muted">
        Prøv igjen om et øyeblikk. Kontakt administrator hvis problemet fortsetter.
      </p>
      <button className="button" onClick={reset}>
        Prøv igjen
      </button>
    </main>
  );
}
