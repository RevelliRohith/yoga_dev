"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/programs", label: "Yoga Programs", icon: "✳" },
  { href: "/admin/batches", label: "Batches", icon: "▦" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Administration">{destinations.map(item => {
    const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={active ? "admin-nav-active" : ""} aria-current={active ? "page" : undefined}>
      <span aria-hidden="true">{item.icon}</span>{item.label}
    </Link>;
  })}</nav>;
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const destination = destinations.find(item => item.href !== "/admin" && pathname.startsWith(item.href));
  return <span>Studio / <strong>{destination?.label ?? "Dashboard"}</strong></span>;
}
