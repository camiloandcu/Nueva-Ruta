import { createSupabaseServerClient } from "@/lib/auth/server";

import PartnerReconciliation from "./partner-reconciliation";

export default async function PartnerReconciliationPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Operaciones · WI-006</div>
      <h1>Importación y conciliación de aliados</h1>
      <p>
        Importa únicamente CSV sintéticos de demostración. Los datos originales
        se conservan y las coincidencias inciertas requieren revisión humana.
      </p>
      {data.session ? (
        <PartnerReconciliation />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
