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
  normalized_phone: string | null;
  partner_case_id: string | null;
  normalized_creator_id: string | null;
  quality_issues: string[];
  raw_partner_rows: {
    row_number: number;
    source_values: Record<string, string>;
  };
};
type AvailableLead = {
  id: string;
  business_id: string;
  commercial_stage: string;
};
type Access = { role: "operator" | "analyst" | "supervisor" };
const valueLabels: Record<string, string> = {
  partner_enrollment_id: "Inscripción del socio",
  partner_case_id: "Caso del socio",
  enrollment_date_raw: "Fecha recibida",
  phone_raw: "Teléfono recibido",
  creator_id_raw: "Creador recibido",
  status_raw: "Estado recibido",
};
const rawValue = (values: Record<string, string>, ...keys: string[]) =>
  keys.map((key) => values[key]).find((value) => value?.trim()) ?? "—";

export default function PartnerReconciliation() {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [queue, setQueue] = useState<QueueCase[]>([]);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [visibleQuality, setVisibleQuality] = useState(8);
  const [selectedImport, setSelectedImport] = useState("");
  const [qualityLoading, setQualityLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [availableLeads, setAvailableLeads] = useState<AvailableLead[]>([]);
  const [caseQuery, setCaseQuery] = useState("");
  const [visibleCases, setVisibleCases] = useState(6);
  const [manualSearch, setManualSearch] = useState<Record<string, string>>({});
  const [manualChoice, setManualChoice] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");

  const load = useCallback(async () => {
    try {
      const [importsResponse, queueResponse, accessResponse] =
        await Promise.all([
          fetch("/api/operations/partner-imports", { cache: "no-store" }),
          fetch("/api/operations/partner-imports/reconciliation/queue", {
            cache: "no-store",
          }),
          fetch("/api/operations/creator-content/access", {
            cache: "no-store",
          }),
        ]);
      setLoadError(
        !importsResponse.ok || !queueResponse.ok || !accessResponse.ok,
      );
      if (importsResponse.ok) setImports(await importsResponse.json());
      if (queueResponse.ok) setQueue(await queueResponse.json());
      if (accessResponse.ok) {
        const nextAccess = (await accessResponse.json()) as Access;
        setAccess(nextAccess);
        if (["analyst", "supervisor"].includes(nextAccess.role)) {
          const leadsResponse = await fetch(
            "/api/operations/partner-imports/reconciliation/available-leads",
            { cache: "no-store" },
          );
          if (leadsResponse.ok) setAvailableLeads(await leadsResponse.json());
          else setLoadError(true);
        }
      }
    } catch {
      setLoadError(true);
    }
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
    try {
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
      if (response.ok) setRefresh((value) => value + 1);
    } catch {
      setMessage("No se pudo conectar para importar. Vuelve a intentar.");
    } finally {
      setBusy(false);
    }
  }

  async function process(jobId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/partner-imports/${jobId}/dispatch`, {
        method: "POST",
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? `Análisis completado: ${result.normalized_count} filas normalizadas y ${result.case_count} casos.`
          : `No se procesó: ${result.detail ?? "error de análisis"}`,
      );
      if (response.ok) setRefresh((value) => value + 1);
    } catch {
      setMessage("No se pudo conectar para procesar. Vuelve a intentar.");
    } finally {
      setBusy(false);
    }
  }

  async function showQuality(jobId: string) {
    if (selectedImport === jobId) {
      setSelectedImport("");
      return;
    }
    setQualityLoading(true);
    try {
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
      setVisibleQuality(8);
      window.setTimeout(
        () =>
          document
            .getElementById("import-quality")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        0,
      );
    } catch {
      setMessage(
        "No se pudo conectar para comparar las filas. Vuelve a intentar.",
      );
    } finally {
      setQualityLoading(false);
    }
  }

  async function review(form: FormData, item: QueueCase) {
    const action = String(form.get("action"));
    const leadId = String(
      form.get(action === "link" ? "manual_lead_id" : "lead_id") || "",
    );
    if (action !== "reject" && !leadId) {
      setReviewFeedback(
        "Selecciona un caso CRM antes de vincular la inscripción.",
      );
      return;
    }
    setReviewingId(item.id);
    try {
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
      setReviewFeedback(
        response.ok
          ? `Revisión registrada: ${result.status}. La inscripción y su caso ya reflejan la decisión.`
          : `No se guardó: ${result.detail ?? "error de revisión"}`,
      );
      if (response.ok) setRefresh((value) => value + 1);
    } catch {
      setReviewFeedback(
        "No se pudo conectar para guardar la revisión. Vuelve a intentar.",
      );
    } finally {
      setReviewingId(null);
    }
  }

  const reviewQueue = queue.filter(
    (item) =>
      ["review_required", "unmatched"].includes(item.status) &&
      (!caseQuery ||
        `${item.partner_canonical_enrollments.partner_enrollment_id ?? ""} ${item.partner_canonical_enrollments.source_row_numbers.join(" ")}`
          .toLocaleLowerCase()
          .includes(caseQuery.toLocaleLowerCase())),
  );

  return (
    <div className="workspace-stack">
      {loadError && (
        <p className="error-panel" role="alert">
          No se cargaron todas las importaciones o revisiones.{" "}
          <button type="button" onClick={() => void load()}>
            Reintentar carga
          </button>
        </p>
      )}
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
      <div className="operation-grid partner-workspace">
        <section className="panel partner-import-panel">
          <h2>Importar CSV</h2>
          <p>
            Límite 5 MiB / 5.000 filas. Columnas admitidas: enrollment ID
            (obligatoria), case ID, fecha, teléfono, creator ID y estado. No
            subas datos personales reales.
          </p>
          {access === null ? (
            <p>Cargando permisos…</p>
          ) : access.role === "analyst" ? (
            <p>
              La importación corresponde al operador o supervisor. Puedes
              revisar las filas y la conciliación debajo.
            </p>
          ) : (
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
              <button disabled={busy}>
                {busy ? "Importando…" : "Importar filas originales"}
              </button>
            </form>
          )}
        </section>

        <section className="panel partner-import-list">
          <h2>Importaciones</h2>
          {imports.length === 0 && <p>Aún no hay archivos importados.</p>}
          {imports.map((job) => (
            <article className="evidence-card" key={job.id}>
              <strong>{job.filename}</strong>
              <p>
                {job.row_count} filas originales · {job.normalized_count} filas
                normalizadas
              </p>
              <details className="import-identifier">
                <summary>Identificadores del archivo</summary>
                <p>
                  SHA-256:{" "}
                  <code className="long-token">{job.file_checksum}</code>
                </p>
                <p>
                  Importación: <code className="long-token">{job.id}</code>
                </p>
              </details>
              {job.normalized_count > 0 && (
                <button
                  type="button"
                  aria-expanded={selectedImport === job.id}
                  aria-controls="import-quality"
                  disabled={qualityLoading}
                  onClick={() => void showQuality(job.id)}
                >
                  {qualityLoading
                    ? "Cargando filas…"
                    : selectedImport === job.id
                      ? "Ocultar comparación de filas"
                      : "Comparar filas originales y normalizadas"}
                </button>
              )}
              {job.normalized_count === 0 && access?.role !== "analyst" && (
                <button disabled={busy} onClick={() => void process(job.id)}>
                  Procesar importación
                </button>
              )}
            </article>
          ))}
        </section>

        {selectedImport && (
          <section className="panel quality-panel" id="import-quality">
            <div className="section-heading">
              <div>
                <h2 tabIndex={-1}>Qué cambió al limpiar el archivo</h2>
              </div>
              <span className="count-pill">{quality.length}</span>
            </div>
            <p>
              Compara cada valor recibido con el que se usará para conciliar.
              «—» indica que no pudo normalizarse.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Inscripción</th>
                    <th>Fecha recibida → normalizada</th>
                    <th>Teléfono recibido → normalizado</th>
                    <th>Creador recibido → normalizado</th>
                    <th>Incidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.slice(0, visibleQuality).map((row) => (
                    <tr key={row.id}>
                      <td data-label="Fila">
                        {row.raw_partner_rows.row_number}
                      </td>
                      <td data-label="Inscripción">
                        {rawValue(
                          row.raw_partner_rows.source_values,
                          "partner_enrollment_id",
                          "enrollment_id",
                        )}
                      </td>
                      <td data-label="Fecha recibida → normalizada">
                        {rawValue(
                          row.raw_partner_rows.source_values,
                          "enrollment_date_raw",
                          "enrollment_date",
                          "date",
                        )}{" "}
                        → <strong>{row.enrollment_date ?? "—"}</strong>
                      </td>
                      <td data-label="Teléfono recibido → normalizado">
                        {rawValue(
                          row.raw_partner_rows.source_values,
                          "phone_raw",
                          "phone",
                        )}{" "}
                        → <strong>{row.normalized_phone ?? "—"}</strong>
                      </td>
                      <td data-label="Creador recibido → normalizado">
                        {rawValue(
                          row.raw_partner_rows.source_values,
                          "creator_id_raw",
                          "creator_id",
                        )}{" "}
                        → <strong>{row.normalized_creator_id ?? "—"}</strong>
                      </td>
                      <td data-label="Incidencias">
                        {row.quality_issues.join(", ") || "Sin incidencias"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quality.length > visibleQuality && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setVisibleQuality((count) => count + 8)}
              >
                Mostrar 8 filas más · {quality.length - visibleQuality}{" "}
                pendientes
              </button>
            )}
          </section>
        )}

        <section className="panel partner-review-panel">
          <h2>Revisión de conciliación</h2>
          <p>
            Potencialmente comisionables (proxy, sin monto):{" "}
            {queue.filter((item) => item.potentially_commissionable).length} ·
            Requieren revisión:{" "}
            {queue.filter((item) => item.status === "review_required").length} ·
            Sin conciliar:{" "}
            {queue.filter((item) => item.status === "unmatched").length}
          </p>
          <p>
            Una coincidencia sugerida se puede confirmar; también puedes buscar
            otro caso CRM o descartar el vínculo. Solo analista o supervisor
            registra la decisión.
          </p>
          {reviewFeedback && (
            <p className="inline-message" role="status" aria-live="polite">
              {reviewFeedback}
            </p>
          )}
          <label className="review-search">
            Buscar inscripción o número de fila
            <input
              type="search"
              value={caseQuery}
              onChange={(event) => {
                setCaseQuery(event.target.value);
                setVisibleCases(6);
              }}
              placeholder="ENR-001 o fila 12"
            />
          </label>
          {reviewQueue.length === 0 && (
            <p>No hay revisiones con este filtro.</p>
          )}
          <div className="reconciliation-list">
            {reviewQueue.slice(0, visibleCases).map((item) => {
              const canonical = item.partner_canonical_enrollments;
              return (
                <article
                  className="evidence-card reconciliation-card"
                  key={item.id}
                >
                  <h3>
                    {canonical.partner_enrollment_id ??
                      "ID externo en conflicto"}
                  </h3>
                  <span className="badge">
                    {item.status === "review_required"
                      ? "Revisión requerida"
                      : "Sin coincidencia"}
                  </span>
                  <p>Filas fuente: {canonical.source_row_numbers.join(", ")}</p>
                  <h4>Valores conservados del archivo</h4>
                  <dl className="reconciliation-values">
                    {Object.entries(canonical.canonical_values).length ? (
                      Object.entries(canonical.canonical_values).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt>
                              {valueLabels[key] ?? key.replaceAll("_", " ")}
                            </dt>
                            <dd>{value || "—"}</dd>
                          </div>
                        ),
                      )
                    ) : (
                      <div>
                        <dt>Datos del registro</dt>
                        <dd>
                          Las filas discrepan; revisa los originales antes de
                          vincular.
                        </dd>
                      </div>
                    )}
                  </dl>
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
                  {access && ["analyst", "supervisor"].includes(access.role) ? (
                    <form
                      action={(form) => void review(form, item)}
                      className="reconciliation-actions"
                    >
                      {item.partner_reconciliation_candidates.length > 0 ? (
                        <label>
                          Coincidencia sugerida
                          <select
                            name="lead_id"
                            defaultValue={
                              item.partner_reconciliation_candidates.length ===
                              1
                                ? item.partner_reconciliation_candidates[0]
                                    .lead_id
                                : ""
                            }
                          >
                            {item.partner_reconciliation_candidates.length >
                              1 && <option value="">Elige un candidato</option>}
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
                      ) : (
                        <p>
                          No se encontró una coincidencia sugerida para estas
                          filas.
                        </p>
                      )}
                      <label>
                        Buscar otro caso CRM
                        <input
                          type="search"
                          value={manualSearch[item.id] ?? ""}
                          onChange={(event) =>
                            setManualSearch((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Escribe un código LEAD"
                        />
                      </label>
                      <label>
                        Vincular con otro caso CRM
                        <select
                          name="manual_lead_id"
                          value={manualChoice[item.id] ?? ""}
                          onChange={(event) =>
                            setManualChoice((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona un caso distinto</option>
                          {availableLeads
                            .filter(
                              (lead) =>
                                lead.id === manualChoice[item.id] ||
                                `${lead.business_id} ${lead.commercial_stage}`
                                  .toLocaleLowerCase()
                                  .includes(
                                    (
                                      manualSearch[item.id] ?? ""
                                    ).toLocaleLowerCase(),
                                  ),
                            )
                            .map((lead) => (
                              <option key={lead.id} value={lead.id}>
                                {lead.business_id} · {lead.commercial_stage}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Motivo de decisión
                        <input
                          name="reason"
                          required
                          maxLength={500}
                          placeholder="Explica la evidencia que justifica la decisión"
                        />
                      </label>
                      <div className="reconciliation-buttons">
                        <button
                          name="action"
                          value="accept"
                          disabled={
                            reviewingId !== null ||
                            item.partner_reconciliation_candidates.length === 0
                          }
                        >
                          Confirmar coincidencia sugerida
                        </button>
                        <button
                          name="action"
                          value="link"
                          disabled={
                            reviewingId !== null || availableLeads.length === 0
                          }
                        >
                          Vincular otro caso
                        </button>
                        <button
                          name="action"
                          value="reject"
                          disabled={reviewingId !== null}
                        >
                          Descartar vínculo
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="selection-hint">
                      La revisión la registra un analista o supervisor.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          {reviewQueue.length > visibleCases && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setVisibleCases((count) => count + 6)}
            >
              Mostrar 6 revisiones más · {reviewQueue.length - visibleCases}{" "}
              pendientes
            </button>
          )}
        </section>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}
