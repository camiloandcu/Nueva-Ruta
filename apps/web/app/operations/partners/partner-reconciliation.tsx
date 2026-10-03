"use client";

import { useCallback, useEffect, useState } from "react";

type ImportJob = {
  id: string;
  filename: string;
  file_checksum: string;
  imported_at: string;
  row_count: number;
  normalized_count: number;
};
type Candidate = {
  lead_id: string;
  match_method: string;
  leads?: { business_id: string };
};
type QueueCase = {
  id: string;
  status: string;
  match_method: string | null;
  conflict_flags: string[];
  potentially_commissionable: boolean;
  partner_canonical_enrollments: {
    partner_enrollment_id: string | null;
    source_row_numbers: number[];
    canonical_values: Record<string, string>;
    quality_issues: string[];
    conflicted: boolean;
  };
  partner_reconciliation_candidates: Candidate[];
  partner_reconciliation_decisions: {
    action: string;
    reason: string;
    created_at: string;
    actor_id: string;
    lead_id: string | null;
  }[];
};

export default function PartnerReconciliation() {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [queue, setQueue] = useState<QueueCase[]>([]);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [importsResponse, queueResponse] = await Promise.all([
      fetch("/api/operations/partner-imports", { cache: "no-store" }),
      fetch("/api/operations/partner-imports/reconciliation/queue", {
        cache: "no-store",
      }),
    ]);
    if (importsResponse.ok) setImports(await importsResponse.json());
    if (queueResponse.ok) setQueue(await queueResponse.json());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refresh]);

  async function upload(form: FormData) {
    const file = form.get("partner_csv");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Selecciona un archivo CSV.");
      return;
    }
    setBusy(true);
    const query = new URLSearchParams({
      filename: file.name,
      synthetic: "true",
    });
    const response = await fetch(`/api/operations/partner-imports?${query}`, {
      method: "POST",
      headers: { "Content-Type": "text/csv; charset=utf-8" },
      body: file,
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `Importación ${result.replayed ? "ya registrada" : "creada"}: ${result.row_count} filas (${result.import_job_id}).`
        : `No se importó: ${result.detail ?? "error de validación"}`,
    );
    setBusy(false);
    if (response.ok) setRefresh((value) => value + 1);
  }

  async function process(jobId: string) {
    setBusy(true);
    const response = await fetch(`/api/partner-imports/${jobId}/dispatch`, {
      method: "POST",
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `Análisis completado: ${result.normalized_count} filas normalizadas y ${result.case_count} casos.`
        : `No se procesó: ${result.detail ?? "error de análisis"}`,
    );
    setBusy(false);
    if (response.ok) setRefresh((value) => value + 1);
  }

  async function review(form: FormData, item: QueueCase) {
    const action = String(form.get("action"));
    const leadId = String(form.get("lead_id") || "");
    const response = await fetch(
      `/api/operations/partner-imports/reconciliation/${item.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lead_id: leadId || null,
          reason: String(form.get("reason")),
          correlation_id: `wi006-${crypto.randomUUID()}`,
        }),
      },
    );
    const result = await response.json();
    setMessage(
      response.ok
        ? `Decisión registrada: ${result.status}.`
        : `No se guardó: ${result.detail ?? "error de revisión"}`,
    );
    if (response.ok) setRefresh((value) => value + 1);
  }

  return (
    <div className="operation-grid">
      <section className="panel">
        <h2>Importar CSV sintético</h2>
        <p>
          Límite 5 MiB / 5.000 filas. Columnas admitidas: enrollment ID
          (obligatoria), case ID, fecha, teléfono, creator ID y estado. No subas
          datos de personas reales.
        </p>
        <form action={(form) => void upload(form)}>
          <label>
            Archivo CSV
            <input
              name="partner_csv"
              type="file"
              accept=".csv,text/csv"
              required
            />
          </label>
          <label>
            <input name="synthetic_confirmation" type="checkbox" required />
            Confirmo que el archivo contiene solo datos ficticios/sintéticos.
          </label>
          <button disabled={busy}>Importar filas originales</button>
        </form>
      </section>

      <section className="panel">
        <h2>Importaciones</h2>
        {imports.map((job) => (
          <article className="evidence-card" key={job.id}>
            <strong>{job.filename}</strong>
            <p>
              {job.row_count} filas · normalizadas {job.normalized_count} ·
              SHA-256 {job.file_checksum}
            </p>
            <code>{job.id}</code>
            {job.normalized_count === 0 && (
              <button disabled={busy} onClick={() => void process(job.id)}>
                Procesar importación
              </button>
            )}
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>Revisión de conciliación</h2>
        <p>
          Potencialmente comisionables (proxy, sin monto):{" "}
          {queue.filter((item) => item.potentially_commissionable).length} ·
          Requieren revisión:{" "}
          {queue.filter((item) => item.status === "review_required").length} ·
          Sin conciliar:{" "}
          {queue.filter((item) => item.status === "unmatched").length}
        </p>
        {queue
          .filter((item) =>
            ["review_required", "unmatched"].includes(item.status),
          )
          .map((item) => {
            const canonical = item.partner_canonical_enrollments;
            return (
              <article className="evidence-card" key={item.id}>
                <strong>
                  {canonical.partner_enrollment_id ?? "ID externo en conflicto"}
                </strong>
                <p>Filas fuente: {canonical.source_row_numbers.join(", ")}</p>
                <p>
                  Valores originales:{" "}
                  {JSON.stringify(canonical.canonical_values)}
                </p>
                <p>
                  Calidad:{" "}
                  {canonical.quality_issues.join(", ") || "Sin incidencias"}
                </p>
                <p>Conflictos: {item.conflict_flags.join(", ") || "Ninguno"}</p>
                {item.partner_reconciliation_decisions.map((decision) => (
                  <p key={`${decision.created_at}-${decision.actor_id}`}>
                    Revisión previa: {decision.action} · {decision.reason} ·{" "}
                    {decision.created_at}
                  </p>
                ))}
                <form action={(form) => void review(form, item)}>
                  <label>
                    Lead candidato
                    <select name="lead_id" defaultValue="">
                      <option value="">
                        Selecciona si enlazas manualmente
                      </option>
                      {item.partner_reconciliation_candidates.map(
                        (candidate) => (
                          <option
                            key={candidate.lead_id}
                            value={candidate.lead_id}
                          >
                            {candidate.leads?.business_id ?? candidate.lead_id}{" "}
                            · {candidate.match_method}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Motivo de decisión
                    <input name="reason" required maxLength={500} />
                  </label>
                  <div className="operation-grid">
                    <button name="action" value="accept">
                      Aceptar candidato
                    </button>
                    <button name="action" value="reject">
                      Rechazar
                    </button>
                    <button name="action" value="link">
                      Enlazar manualmente
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
      </section>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
