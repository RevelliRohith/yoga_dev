"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/programs", label: "Yoga Programs", icon: "✳" },
  { href: "/admin/batches", label: "Batches", icon: "▦" },
  { href: "/admin/trainers", label: "Trainers", icon: "\u2733" },
  { href: "/admin/students", label: "Students", icon: "\u25c7" },
  { href: "/admin/fees", label: "Fees & receipts", icon: "\u20b9" },
  { href: "/admin/inquiries", label: "Inquiries", icon: "?" },
  { href: "/admin/events", label: "Events", icon: "?" },
  { href: "/admin/certificates", label: "Certificates", icon: "?" },
  { href: "/admin/reminders", label: "Reminders", icon: "?" },
  { href: "/admin/reports", label: "Reports", icon: "?" },
  { href: "/admin/settings", label: "Studio settings", icon: "?" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration">
      {destinations.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "admin-nav-active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const destination = destinations.find(
    (item) => item.href !== "/admin" && pathname.startsWith(item.href),
  );
  return (
    <span>
      Studio / <strong>{destination?.label ?? "Dashboard"}</strong>
    </span>
  );
}
