import Link from "next/link";
import { can, type Permission } from "@/lib/domain/permissions";
import { requireStaff } from "@/lib/server/staff";
import { logoutAction } from "../login/actions";
import "../admin.css";

export const metadata = { title: { default: "Compadres Cigars Admin Portal", template: "%s | Compadres Cigars Admin Portal" }, robots: { index: false, follow: false } };

const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "Dashboard", perm: "view" },
  { href: "/admin/orders", label: "Store", perm: "view" },
  { href: "/admin/products", label: "Products", perm: "view" },
  { href: "/admin/payments", label: "Payments", perm: "view" },
  { href: "/admin/operations", label: "Operations", perm: "view" },
  { href: "/admin/analytics", label: "Analytics", perm: "view_reports" },
  { href: "/admin/sales-tax", label: "Sales & Tax", perm: "view_reports" },
  { href: "/admin/audit", label: "Audit Log", perm: "view_audit" },
  { href: "/admin/restrictions", label: "Restrictions", perm: "manage_restrictions" },
  { href: "/admin/users", label: "Users", perm: "manage_users" },
  { href: "/admin/settings", label: "Settings", perm: "manage_restrictions" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="adm">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="adm-side">
        <p className="adm-brand">Compadres Cigars Admin Portal</p>
        <nav aria-label="Admin">
          {NAV.filter((n) => can(staff.role, n.perm)).map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
        <form action={logoutAction} className="adm-user">
          <p>{staff.email}<br /><span>{staff.role}</span></p>
          <button className="adm-link" type="submit">Sign out</button>
        </form>
      </aside>
      <main id="main" className="adm-main">{children}</main>
    </div>
  );
}
