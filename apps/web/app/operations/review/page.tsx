import { createSupabaseServerClient } from "@/lib/auth/server";

import ReviewQueue from "./review-queue";

export default async function ReviewPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Operaciones · WI-004</div>
      <h1>Revisión humana</h1>
      <p>
        Solo se muestra evidencia redactada. Aprobar registra evidencia, pero no
        entrega mensajes.
      </p>
      {data.session ? (
        <ReviewQueue />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
