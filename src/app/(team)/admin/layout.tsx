import Link from "next/link";
import { requireAdmin } from "@/server/queries";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <nav className="admin-nav" aria-label="Administrasjon">
        <Link href="/admin/users">Brukere og tilganger</Link>
        <Link href="/admin/notifications">Varselinnstillinger</Link>
        <Link href="/admin/images">Bildeinnstillinger</Link>
      </nav>
      {children}
    </>
  );
}
