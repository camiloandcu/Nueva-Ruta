"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Access = { role: "operator" | "supervisor" | "analyst" };
const links = [
  {
    href: "/operations/review",
    label: "Bandeja",
    roles: ["operator", "supervisor"],
  },
  {
    href: "/operations/crm",
    label: "Casos",
    roles: ["operator", "supervisor"],
  },
  {
    href: "/operations/work",
    label: "Operación",
    roles: ["operator", "supervisor"],
  },
  {
    href: "/operations/reports",
    label: "Resultados",
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
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function load() {
      try {
        const response = await fetch("/api/operations/creator-content/access", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setStatus("unavailable");
            return;
          }
          throw new Error("Navigation service unavailable");
        }
        const value = (await response.json()) as Access;
        if (!["operator", "supervisor", "analyst"].includes(value.role)) {
          setStatus("unavailable");
          return;
        }
        setAccess(value);
        setStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        attempts += 1;
        if (attempts < 8) {
          timer = setTimeout(load, Math.min(1500 * 2 ** (attempts - 1), 20000));
        } else {
          setStatus("unavailable");
        }
      }
    }

    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [retryKey]);

  if (status === "loading") {
    return (
      <span className="site-nav-status" role="status">
        Cargando navegación…
      </span>
    );
  }
  if (status === "unavailable" || !access) {
    return (
      <button
        className="site-nav-retry"
        type="button"
        onClick={() => {
          setStatus("loading");
          setRetryKey((key) => key + 1);
        }}
      >
        Reintentar navegación
      </button>
    );
  }
  return (
    <nav className="site-nav" aria-label="Navegación principal">
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
