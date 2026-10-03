import { createSupabaseServerClient } from "@/lib/auth/server";

import CrmOperations from "./crm-operations";

export default async function CrmPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Operaciones · WI-005</div>
      <h1>CRM y transferencias</h1>
      <p>
        Las etapas comerciales, las escalaciones y las entregas se registran por
        separado.
      </p>
      {data.session ? (
        <CrmOperations />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
