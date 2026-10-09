import Image from "next/image";
import { can, type Permission } from "@/lib/domain/permissions";
import { loadStockAlerts } from "@/lib/server/admin-data";
import { requireStaff } from "@/lib/server/staff";
import { logoutAction } from "../login/actions";
import { AdminNav } from "./AdminNav";
import "../admin.css";

export const metadata = { title: { default: "Compadres Cigars Admin Portal", template: "%s | Compadres Cigars Admin Portal" }, robots: { index: false, follow: false } };

const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "Dashboard", perm: "view" },
  { href: "/admin/orders", label: "Store", perm: "view" },
  { href: "/admin/products", label: "Products", perm: "view" },
  { href: "/admin/brands", label: "Brands", perm: "view" },
  { href: "/admin/payments", label: "Payments", perm: "view" },
  { href: "/admin/emails", label: "Emails", perm: "manage_email" },
  { href: "/admin/operations", label: "Operations", perm: "view" },
  { href: "/admin/analytics", label: "Analytics", perm: "view_reports" },
  { href: "/admin/sales-tax", label: "Sales & Tax", perm: "view_reports" },
  { href: "/admin/tax-rates", label: "Tax Rates", perm: "manage_tax" },
  { href: "/admin/audit", label: "Audit Log", perm: "view_audit" },
  { href: "/admin/restrictions", label: "Restrictions", perm: "manage_restrictions" },
  { href: "/admin/users", label: "Users", perm: "manage_users" },
  { href: "/admin/settings", label: "Settings", perm: "manage_restrictions" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const lowStock = await loadStockAlerts().then((a) => a.length, () => 0);
  return (
    <div className="adm">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="adm-side">
        <div className="adm-logo">
          <Image src="/images/crest.png" alt="" width={56} height={56} />
          <p className="adm-brand">Compadres Cigars Admin Portal</p>
        </div>
        <AdminNav items={NAV.filter((n) => can(staff.role, n.perm)).map(({ href, label }) => ({ href, label, badge: href === "/admin/products" ? lowStock : 0 }))} />
        <form action={logoutAction} className="adm-user">
          <p>{staff.email}<br /><span>{staff.role}</span></p>
          <button className="adm-link" type="submit">Sign out</button>
        </form>
      </aside>
      <main id="main" className="adm-main">{children}</main>
    </div>
  );
}
