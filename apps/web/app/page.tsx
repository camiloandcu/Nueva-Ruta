import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/auth/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main>
      <div className="eyebrow">Fundación local · WI-001</div>
      <h1>Nueva Ruta</h1>
      <p>
        Bandejas y controles para revisar leads, gestionar políticas y completar
        transferencias sintéticas con autorización humana.
      </p>
      {data.user ? (
        <nav aria-label="Operaciones" className="operation-grid">
          <a href="/operations/review">Revisión de borradores</a>
          <a href="/operations/crm">CRM y transferencias</a>
          <a href="/operations/ai">Observabilidad de IA</a>
          <a href="/operations/partners">Importación y conciliación</a>
          <a href="/operations/reports">Funnel y atribución</a>
          <a href="/operations/creators">Creadores y contenido</a>
          <a href="/rules">Reglas</a>
        </nav>
      ) : (
        <p>
          Inicia sesión con una cuenta demo autorizada para ver las operaciones.{" "}
          <Link href="/login">Ir al acceso privado</Link>
        </p>
      )}
    </main>
  );
}
