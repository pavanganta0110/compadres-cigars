"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin">
      {items.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path === n.href || path.startsWith(`${n.href}/`);
        return <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}>{n.label}</Link>;
      })}
    </nav>
  );
}
