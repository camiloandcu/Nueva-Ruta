import { createSupabaseServerClient } from "@/lib/auth/server";

import CrmOperations from "./crm-operations";

export default async function CrmPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Automatización comercial</div>
      <h1>CRM y transferencias</h1>
      <p>
        Una disposición mueve la etapa y conserva su historial. Los mensajes,
        escalaciones y entregas tienen controles propios.
      </p>
      {data.session ? (
        <CrmOperations />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
