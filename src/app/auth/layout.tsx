import { PaletteSelector } from "@/components/palette-selector";
import { Brand } from "@/components/ui";
import { LockKeyhole } from "lucide-react";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <h1>
            Lagrommet<span className="brand-dot">.</span>
          </h1>
          <div className="auth-court" aria-hidden="true">
            <svg viewBox="0 0 600 300" fill="none">
              <path d="M80 260 210 30h280l60 230H80Z" stroke="currentColor" strokeWidth="2" />
              <path d="m145 145 375 0M350 30l-20 230" stroke="currentColor" />
              <path d="M185 70h315m-300-30h292" stroke="currentColor" strokeDasharray="4 5" />
              <circle cx="390" cy="175" r="48" stroke="var(--accent)" strokeWidth="2" />
              <path
                d="M344 167c32-12 60 14 59 53m-23-91c-13 28 9 61 53 57m-65 28c8-16 24-26 42-29"
                stroke="var(--accent)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-private">
          <LockKeyhole size={14} /> KUN FOR LAGET
        </div>
        <div className="auth-form-wrap">{children}</div>
        <PaletteSelector />
      </section>
    </main>
  );
}
