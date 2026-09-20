import Link from "next/link";
import { ArrowLeft, ArrowRight, Volleyball } from "lucide-react";
import type { ReactNode } from "react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/feed" aria-label="NTNUI Volleyball – til innlegg">
      <span className="brand-mark">
        <Volleyball size={27} strokeWidth={1.5} />
      </span>
      <span>
        <strong>
          NTNUI<span className="brand-dot">.</span>
        </strong>
        {!compact && <small>VOLLEYBALL · D2A</small>}
      </span>
    </Link>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>
          {title}
          <span className="brand-dot">.</span>
        </h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon ?? <Volleyball size={30} />}</span>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`avatar ${large ? "avatar-large" : ""}`} aria-hidden="true">
      {name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Pagination({
  page,
  count,
  size,
  href,
}: {
  page: number;
  count: number;
  size: number;
  href: string;
}) {
  if (count <= size && page === 1) return null;
  return (
    <nav className="pagination" aria-label="Sidenavigering">
      {page > 1 ? (
        <Link
          className="button secondary"
          href={`${href}${href.includes("?") ? "&" : "?"}page=${page - 1}`}
        >
          <ArrowLeft size={16} /> Forrige
        </Link>
      ) : (
        <span />
      )}
      <span className="muted">
        Side {page} av {Math.max(1, Math.ceil(count / size))}
      </span>
      {page * size < count ? (
        <Link
          className="button secondary"
          href={`${href}${href.includes("?") ? "&" : "?"}page=${page + 1}`}
        >
          Neste <ArrowRight size={16} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="back-link" href={href}>
      <ArrowLeft size={15} />
      {children}
    </Link>
  );
}
export function pageNumber(value?: string) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
}
