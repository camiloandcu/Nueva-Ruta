"use client";

import { useCallback, useEffect, useState } from "react";

type Lead = {
  source_event_id: string;
  external_event_id: string;
  redacted_body: string;
  redaction_types: string[];
  decision: string;
  reason_code: string;
};
type Draft = { id: string; content: string; content_checksum: string; created_at: string };

export default function ReviewQueue() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [leadResponse, draftResponse] = await Promise.all([
      fetch("/api/operations/operational/redacted-leads", { cache: "no-store" }),
      fetch("/api/operations/drafts/pending", { cache: "no-store" }),
    ]);
    if (leadResponse.ok) setLeads(await leadResponse.json());
    if (draftResponse.ok) setDrafts(await draftResponse.json());
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function approve(draft: Draft) {
    const response = await fetch(`/api/operations/drafts/${draft.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.content, correlation_id: `web-${draft.id}` }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Aprobado y auditado; no entregado." : `Bloqueado: ${result.detail}`);
    await load();
  }

  return (
    <div className="operation-grid">
      <section className="panel">
        <h2>Leads redactados</h2>
        {leads.map((lead) => (
          <article key={lead.source_event_id} className="evidence-card">
            <strong>{lead.external_event_id}</strong>
            <p>{lead.redacted_body}</p>
            <span className={`badge badge-${lead.decision}`}>{lead.reason_code}</span>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Borradores pendientes</h2>
        {drafts.map((draft) => (
          <article key={draft.id} className="evidence-card">
            <textarea aria-label="Contenido para aprobación" defaultValue={draft.content} readOnly />
            <button onClick={() => void approve(draft)}>Aprobar sin entregar</button>
          </article>
        ))}
        <p aria-live="polite">{message}</p>
      </section>
    </div>
  );
}
