"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Access = { role: "operator" | "supervisor" | "analyst" };

const areas = [
  {
    number: "01",
    title: "Bandeja",
    description: "Revisa las consultas recibidas y sus borradores pendientes.",
    links: [
      {
        href: "/operations/review",
        label: "Abrir Entrada",
        roles: ["operator", "supervisor"],
      },
    ],
  },
  {
    number: "02",
    title: "Casos",
    description: "Continúa un lead concreto desde su etapa y su evidencia.",
    links: [
      {
        href: "/operations/crm",
        label: "Abrir casos CRM",
        roles: ["operator", "supervisor"],
      },
    ],
  },
  {
    number: "03",
    title: "Operación",
    description:
      "Atiende escalaciones, recuperación y entregas pendientes de toda la operación.",
    links: [
      {
        href: "/operations/work",
        label: "Abrir colas globales",
        roles: ["operator", "supervisor"],
      },
    ],
  },
  {
    number: "04",
    title: "Resultados",
    description:
      "Consulta el embudo, los bloqueos y la conciliación con el socio.",
    links: [
      {
        href: "/operations/reports",
        label: "Ver informes",
        roles: ["operator", "supervisor", "analyst"],
      },
      {
        href: "/operations/partners",
        label: "Ver conciliación",
        roles: ["operator", "supervisor", "analyst"],
      },
    ],
  },
  {
    number: "05",
    title: "Administración",
    description:
      "Consulta contenido planificado y, según tu rol, reglas y ejecuciones.",
    links: [
      {
        href: "/operations/creators",
        label: "Ver contenido",
        roles: ["operator", "supervisor", "analyst"],
      },
      { href: "/rules", label: "Gestionar reglas", roles: ["supervisor"] },
      {
        href: "/operations/ai",
        label: "Ver ejecuciones",
        roles: ["supervisor"],
      },
    ],
  },
] as const;

export default function HomeWorkspace() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadAccess = useCallback(() => {
    fetch("/api/operations/creator-content/access", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: Access | null) => setAccess(value))
      .catch(() => setAccess(null))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => loadAccess(), [loadAccess]);
  if (!loaded)
    return <section className="panel">Cargando áreas de trabajo…</section>;
  if (!access)
    return (
      <section className="panel error-panel" role="alert">
        No fue posible cargar tu acceso.{" "}
        <button
          type="button"
          onClick={() => {
            setLoaded(false);
            loadAccess();
          }}
        >
          Reintentar
        </button>
      </section>
    );
  return (
    <nav className="journey-grid" aria-label="Áreas de trabajo">
      {areas
        .map((area) => ({
          ...area,
          links: area.links.filter((link) =>
            (link.roles as readonly string[]).includes(access.role),
          ),
        }))
        .filter((area) => area.links.length > 0)
        .map((area) => (
          <article className="journey-card" key={area.number}>
            <span className="journey-number">{area.number} / 05</span>
            <h2>{area.title}</h2>
            <p>{area.description}</p>
            <div className="journey-links">
              {area.links.map((link) => (
                <Link
                  className="journey-action"
                  href={link.href}
                  key={link.href}
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          </article>
        ))}
    </nav>
  );
}
