import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
export default function SignUp() {
  return (
    <>
      <h2>Opprett konto</h2>
      <p className="auth-intro">
        Opprett en konto. Administrator gir deg tilgang til lagrommet når medlemskapet er godkjent.
      </p>
      <ActionForm auth>
        <input type="hidden" name="mode" value="sign-up" />
        <label>
          Fullt navn
          <input
            name="full_name"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            placeholder="Fornavn Etternavn"
          />
        </label>
        <label>
          E-postadresse
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="deg@eksempel.no"
          />
        </label>
        <label>
          Passord
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            placeholder="Minst 12 tegn"
          />
        </label>
        <Submit>Opprett konto</Submit>
      </ActionForm>
      <div className="auth-switch">
        Allerede med? <Link href="/auth/sign-in">Logg inn</Link>
      </div>
    </>
  );
}
