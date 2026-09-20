"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Bell,
  LogOut,
  CheckCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { baseRoles, type Notification, type Profile } from "@/lib/domain";
import { signOut } from "@/server/auth-actions";
import { ActionForm, Submit } from "./forms";
import { Avatar, Brand } from "./ui";
const links = [
  { href: "/feed", label: "Innlegg", icon: LayoutDashboard },
  { href: "/schedule", label: "Terminliste", icon: CalendarDays },
  { href: "/roster", label: "Lag", icon: Users },
];
export function Shell({
  profile,
  notifications,
  children,
}: {
  profile: Profile;
  notifications: Notification[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const unread = notifications.filter((n) => !n.read_at).length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Hopp til innhold
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="nav-label">LAGROMMET</div>
        <nav aria-label="Hovedmeny">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname.startsWith(href) || (href === "/feed" && pathname.startsWith("/posts")) ? "active" : ""}`}
            >
              <Icon size={20} />
              {label}
              {pathname === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        {profile.base_role === "admin" && (
          <>
            <Link
              className={`nav-link admin-label ${pathname.startsWith("/admin") ? "active" : ""}`}
              href="/admin/users"
              aria-label="Administrasjon"
            >
              <ShieldCheck size={20} /> Administrasjon
            </Link>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="team-note">
            <VolleyballMark />
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <span className="topbar-breadcrumb">
            Lagrommet <span>/</span>{" "}
            {pathname.startsWith("/schedule")
              ? "Terminliste"
              : pathname.startsWith("/roster")
                ? "Lag"
                : pathname.startsWith("/admin")
                  ? "Administrasjon"
                  : "Innlegg"}
          </span>
          <div className="topbar-controls">
            <span className="private-label">
              <span className="status-dot" /> Privat lagrom
            </span>
            <details className="notification-menu">
              <summary className="icon-button" aria-label={`Varsler, ${unread} uleste`}>
                <Bell size={20} />
                {unread > 0 && <span className="notification-dot" />}
              </summary>
              <div className="dropdown notification-dropdown">
                <div className="dropdown-heading">
                  <strong>Varsler</strong>
                  <span className="muted">{unread} uleste</span>
                </div>
                {!notifications.length && (
                  <p className="muted notification-empty">Ingen varsler.</p>
                )}
                {notifications.map((n) => (
                  <article key={n.id} className={`notification-item ${n.read_at ? "" : "unread"}`}>
                    <Link
                      href={
                        n.target_id
                          ? `/${n.target_type === "post" ? "posts" : "schedule"}/${n.target_id}`
                          : "/feed"
                      }
                    >
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                    </Link>
                    {!n.read_at && (
                      <ActionForm>
                        <input type="hidden" name="action" value="read-notification" />
                        <input type="hidden" name="id" value={n.id} />
                        <Submit secondary>
                          <CheckCheck size={14} /> Merk som lest
                        </Submit>
                      </ActionForm>
                    )}
                  </article>
                ))}
              </div>
            </details>
            <details className="account-menu">
              <summary className="account-summary" aria-label={`Konto: ${profile.full_name}`}>
                <Avatar name={profile.full_name} />
                <span>
                  <strong>{profile.full_name}</strong>
                  <small>{profile.base_role ? baseRoles[profile.base_role] : ""}</small>
                </span>
              </summary>
              <div className="dropdown account-dropdown">
                <Link href="/auth/update-password">Endre passord</Link>
                <form action={signOut}>
                  <button type="submit">
                    <LogOut size={16} /> Logg ut
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
function VolleyballMark() {
  return (
    <svg width="110" height="80" viewBox="0 0 110 80" fill="none" aria-hidden="true">
      <path
        d="M10 70 30 12h58l12 58H10Z M20 41h74 M48 12 42 70 M69 12l8 58"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="52" cy="33" r="16" stroke="currentColor" />
      <path d="M37 28c12 0 17 10 18 20m-7-30c-2 13 9 19 19 18" stroke="currentColor" />
    </svg>
  );
}
