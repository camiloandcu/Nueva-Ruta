"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Access = { role: "operator" | "supervisor" | "analyst" };
const links = [
  {
    href: "/operations/review",
    label: "Entrada",
    roles: ["operator", "supervisor"],
  },
  { href: "/operations/crm", label: "CRM", roles: ["operator", "supervisor"] },
  {
    href: "/operations/reports",
    label: "Datos",
    roles: ["operator", "supervisor", "analyst"],
  },
  {
    href: "/operations/creators",
    label: "Contenido",
    roles: ["operator", "supervisor", "analyst"],
  },
  {
    href: "/operations/partners",
    label: "Conciliación",
    roles: ["operator", "supervisor", "analyst"],
  },
  { href: "/rules", label: "Reglas", roles: ["supervisor"] },
  { href: "/operations/ai", label: "Ejecuciones", roles: ["supervisor"] },
] as const;

export default function AppNavigation() {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/operations/creator-content/access", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: Access | null) => setAccess(value))
      .catch(() => setAccess(null))
      .finally(() => setLoaded(true));
  }, []);
  if (!loaded || !access) return null;
  return (
    <nav className="site-nav" aria-label="Áreas de trabajo">
      {links
        .filter((link) =>
          (link.roles as readonly string[]).includes(access.role),
        )
        .map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
    </nav>
  );
}
