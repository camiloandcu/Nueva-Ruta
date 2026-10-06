import { createSupabaseServerClient } from "@/lib/auth/server";

import ReviewQueue from "./review-queue";

export default async function ReviewPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return (
    <main className="operations-shell">
      <div className="eyebrow">Precalificación y handoff</div>
      <h1>Entrada y revisión</h1>
      <p>
        Sigue cada mensaje desde su recepción hasta la decisión y la acción
        humana que corresponde.
      </p>
      {data.session ? (
        <ReviewQueue />
      ) : (
        <section className="panel">Autenticación requerida.</section>
      )}
    </main>
  );
}
