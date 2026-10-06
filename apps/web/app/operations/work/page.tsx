import { createSupabaseServerClient } from "@/lib/auth/server";

import CrmOperations from "../crm/crm-operations";

export default async function WorkPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <h1>Operación comercial</h1>
      <p>
        Atiende escalaciones, recuperación, borradores de seguimiento y entregas
        al socio. Cada registro enlaza con su caso cuando existe uno.
      </p>
      {data.session ? (
        <CrmOperations view="operation" />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
