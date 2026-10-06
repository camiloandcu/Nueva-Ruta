import { createSupabaseServerClient } from "@/lib/auth/server";

import CrmOperations from "./crm-operations";

export default async function CrmPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Automatización comercial</div>
      <h1>Casos CRM</h1>
      <p>
        Selecciona un caso, identifica su etapa y completa la siguiente acción
        permitida. Cada decisión conserva su evidencia.
      </p>
      {data.session ? (
        <CrmOperations />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
