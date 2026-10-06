import { createSupabaseServerClient } from "@/lib/auth/server";

import PartnerReconciliation from "./partner-reconciliation";

export default async function PartnerReconciliationPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Calidad de datos</div>
      <h1>Limpieza y conciliación</h1>
      <p>
        Sigue el camino de cada fila desde el archivo original hasta una
        coincidencia confirmada o un caso para revisión.
      </p>
      {data.session ? (
        <PartnerReconciliation />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
