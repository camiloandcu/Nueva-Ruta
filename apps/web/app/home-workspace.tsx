"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Access = { role: "operator" | "supervisor" | "analyst" };

const areas = [
  {
    number: "01",
    title: "Entrada y decisiones",
    description:
      "Ingresa un mensaje, sigue la clasificación y revisa borradores o escalaciones.",
    href: "/operations/review",
    action: "Abrir bandeja",
    roles: ["operator", "supervisor"],
  },
  {
    number: "02",
    title: "Operación CRM",
    description:
      "Registra disposiciones, observa etapas y consulta intentos y recuperación.",
    href: "/operations/crm",
    action: "Abrir CRM",
    roles: ["operator", "supervisor"],
  },
  {
    number: "03",
    title: "Datos y reporting",
    description:
      "Explora el funnel, trabajo estancado, calidad de datos y conciliación.",
    href: "/operations/reports",
    action: "Ver métricas",
    roles: ["operator", "supervisor", "analyst"],
  },
  {
    number: "04",
    title: "Contenido",
    description:
      "Conecta perfiles de creadores y fuentes con guiones sujetos a revisión.",
    href: "/operations/creators",
    action: "Ver contenido",
    roles: ["operator", "supervisor", "analyst"],
  },
] as const;

export default function HomeWorkspace() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/operations/creator-content/access", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: Access | null) => setAccess(value))
      .catch(() => setAccess(null))
      .finally(() => setLoaded(true));
  }, []);
  if (!loaded)
    return <section className="panel">Cargando áreas de trabajo…</section>;
  if (!access)
    return (
      <section className="panel error-panel" role="alert">
        No fue posible cargar tu acceso. Actualiza la página o inicia sesión de
        nuevo.
      </section>
    );
  return (
    <nav className="journey-grid" aria-label="Áreas de trabajo">
      {areas
        .filter((area) =>
          (area.roles as readonly string[]).includes(access.role),
        )
        .map((area) => (
          <Link className="journey-card" href={area.href} key={area.number}>
            <span className="journey-number">{area.number} / 04</span>
            <h2>{area.title}</h2>
            <p>{area.description}</p>
            <span className="journey-action">{area.action} →</span>
          </Link>
        ))}
    </nav>
  );
}
