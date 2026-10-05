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
type QualityRow = {
  id: string;
  partner_enrollment_id: string | null;
  enrollment_date: string | null;
  normalized_creator_id: string | null;
  quality_issues: string[];
  raw_partner_rows: {
    row_number: number;
    source_values: Record<string, string>;
  };
};

export default function PartnerReconciliation() {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [queue, setQueue] = useState<QueueCase[]>([]);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [selectedImport, setSelectedImport] = useState("");

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

  async function showQuality(jobId: string) {
    const response = await fetch(
      "/api/operations/partner-imports/" + jobId + "/quality",
      {
        cache: "no-store",
      },
    );
    if (!response.ok) {
      setMessage("No fue posible abrir la evidencia de limpieza.");
      return;
    }
    setSelectedImport(jobId);
    setQuality((await response.json()) as QualityRow[]);
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
    <div className="workspace-stack">
      <section className="panel">
        <span className="section-kicker">Del archivo a una decisión</span>
        <h2>Cómo se limpian y concilian los datos</h2>
        <div className="pipeline-grid">
          <div>
            <strong>01 · Original</strong>
            <p>Se conserva cada fila, su posición y su checksum.</p>
          </div>
          <div>
            <strong>02 · Normalizado</strong>
            <p>Se revisan teléfono, fecha, creador, duplicados y calidad.</p>
          </div>
          <div>
            <strong>03 · Conciliado</strong>
            <p>
              Una coincidencia exacta se vincula; un conflicto queda para
              revisión.
            </p>
          </div>
          <div>
            <strong>04 · Reportado</strong>
            <p>
              El funnel muestra volumen y bloqueadores sin atribuir casos
              dudosos.
            </p>
          </div>
        </div>
      </section>
      <div className="operation-grid">
        <section className="panel">
          <h2>Importar CSV</h2>
          <p>
            Límite 5 MiB / 5.000 filas. Columnas admitidas: enrollment ID
            (obligatoria), case ID, fecha, teléfono, creator ID y estado. No
            subas datos personales reales.
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
              Confirmo que el archivo no contiene datos personales reales.
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
              {job.normalized_count > 0 && (
                <button onClick={() => void showQuality(job.id)}>
                  Ver filas y limpieza
                </button>
              )}
              {job.normalized_count === 0 && (
                <button disabled={busy} onClick={() => void process(job.id)}>
                  Procesar importación
                </button>
              )}
            </article>
          ))}
        </section>

        {selectedImport && (
          <section className="panel quality-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">
                  Evidencia de transformación
                </span>
                <h2>Filas del archivo</h2>
              </div>
              <span className="count-pill">{quality.length}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>ID original</th>
                    <th>Fecha normalizada</th>
                    <th>Creador normalizado</th>
                    <th>Incidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.map((row) => (
                    <tr key={row.id}>
                      <td>{row.raw_partner_rows.row_number}</td>
                      <td>
                        {row.raw_partner_rows.source_values
                          .partner_enrollment_id ??
                          row.raw_partner_rows.source_values.enrollment_id ??
                          "—"}
                      </td>
                      <td>{row.enrollment_date ?? "—"}</td>
                      <td>{row.normalized_creator_id ?? "—"}</td>
                      <td>
                        {row.quality_issues.join(", ") || "Sin incidencias"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
                    {canonical.partner_enrollment_id ??
                      "ID externo en conflicto"}
                  </strong>
                  <p>Filas fuente: {canonical.source_row_numbers.join(", ")}</p>
                  <p>
                    Valores normalizados:{" "}
                    {JSON.stringify(canonical.canonical_values)}
                  </p>
                  <p>
                    Calidad:{" "}
                    {canonical.quality_issues.join(", ") || "Sin incidencias"}
                  </p>
                  <p>
                    Conflictos: {item.conflict_flags.join(", ") || "Ninguno"}
                  </p>
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
                              {candidate.leads?.business_id ??
                                candidate.lead_id}{" "}
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
    </div>
  );
}
