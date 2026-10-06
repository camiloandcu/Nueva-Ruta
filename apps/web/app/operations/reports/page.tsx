import { createSupabaseServerClient } from "@/lib/auth/server";

import ReportsDashboard from "./reports-dashboard";

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Datos y reporting</div>
      <h1>Flujo, pendientes y atribución</h1>
      <p>
        Volúmenes y riesgos descriptivos; no son una predicción causal ni una
        autorización de pago.
      </p>
      {data.session ? (
        <ReportsDashboard />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
