"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type FunnelStage = {
  stage: string;
  count: number;
  denominator: number | null;
  conversion_percent: number | null;
  received_cohort_percent?: number | null;
};
type EvidenceLink = {
  canonical_enrollment_id: string;
  partner_enrollment_id: string | null;
  status: string;
  conflict_flags: string[];
  source_row_numbers: number[];
  potentially_commissionable: boolean;
};
type StalledItem = {
  kind: string;
  entity_id: string;
  business_id: string | null;
  reason: string;
  age: number | null;
  age_unit: string;
  threshold: number;
  threshold_unit: string;
  rule_version: number;
  owner_role: string;
  owner_id: string | null;
  next_action: string;
  status: string;
};
type Report = {
  filters: { reporting_timezone: string };
  funnel: { lead_stages: FunnelStage[]; enrollment_stages: FunnelStage[] };
  decisions: {
    distribution: Record<string, number>;
    first_system_decision: { samples: number; median_seconds: number | null };
    first_human_action: { samples: number; median_seconds: number | null };
  };
  backlog: {
    pending_drafts: number;
    open_escalations: number;
    breached_escalations: number;
  };
  delivery: {
    logical_transfers: number;
    accepted: number;
    pending: number;
    dead_letter: number;
    outbox_attempts: number;
    median_recovery_seconds: number | null;
  };
  partner: {
    reported: number;
    reconciled: number;
    exact: number;
    ambiguous: number;
    conflicting: number;
    unmatched: number;
    potentially_commissionable: number;
    proxy_blockers: Record<string, number>;
    quality_issues: Record<string, number>;
    evidence_links: EvidenceLink[];
    scope_note: string;
  };
  stalled: StalledItem[];
  stalled_pagination: {
    limit: number;
    offset: number;
    total: number;
    next_offset: number | null;
    previous_offset: number | null;
  };
};
type EnrollmentEvidence = {
  canonical_enrollment_id: string;
  partner_enrollment_id: string | null;
  source_row_numbers: number[];
  quality_issues: string[];
  conflicted: boolean;
  reconciliation: {
    status: string;
    match_method: string | null;
    conflict_flags: string[];
    potentially_commissionable: boolean;
    evidence: Record<string, unknown>;
  } | null;
  source_rows: {
    row_number: number;
    row_checksum: string;
    import_job_id: string;
  }[];
  lead: {
    business_id: string;
    creator_business_id: string | null;
    channel: string;
    commercial_stage: string;
  } | null;
};

const stageLabels: Record<string, string> = {
  received: "Recibidos",
  prequalified: "Precalificados",
  transfer_approved: "Transferencias aprobadas",
  partner_accepted: "Aceptados por el socio",
  enrollment_reported: "Inscripciones reportadas",
  enrollment_reconciled: "Inscripciones conciliadas",
};

function dateValue(offsetDays: number) {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  return day.toISOString().slice(0, 10);
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} %`;
}

function elapsed(value: number | null, unit: string) {
  if (value === null) return "Sin evidencia de tiempo";
  if (unit === "minutes" || unit === "minutes_after_due")
    return `${Math.round(value)} min`;
  if (unit === "seconds") return `${(value / 3600).toFixed(1)} h`;
  if (unit === "business_days") return `${value.toFixed(1)} días hábiles`;
  return `${value.toFixed(1)} h`;
}

export default function ReportsDashboard() {
  const [filters, setFilters] = useState({
    from: dateValue(-30),
    to: dateValue(0),
    creator: "",
    channel: "",
    state: "",
    stalled_limit: "25",
    stalled_offset: "0",
  });
  const [report, setReport] = useState<Report | null>(null);
  const [evidence, setEvidence] = useState<EnrollmentEvidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReport = useCallback(async (values: typeof filters) => {
    setBusy(true);
    setError(null);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values))
      if (value) query.set(key, value);
    try {
      const response = await fetch(
        `/api/operations/reports/overview?${query}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.detail ?? "No fue posible cargar el informe.");
      setReport(payload as Report);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible cargar el informe.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const initialFilters = {
      from: dateValue(-30),
      to: dateValue(0),
      creator: "",
      channel: "",
      state: "",
      stalled_limit: "25",
      stalled_offset: "0",
    };
    void Promise.resolve().then(() => loadReport(initialFilters));
  }, [loadReport]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? ""),
      creator: String(form.get("creator") ?? ""),
      channel: String(form.get("channel") ?? ""),
      state: String(form.get("state") ?? ""),
      stalled_limit: "25",
      stalled_offset: "0",
    };
    setFilters(next);
    await loadReport(next);
  }

  async function navigateStalled(offset: number) {
    const next = { ...filters, stalled_offset: String(offset) };
    setFilters(next);
    await loadReport(next);
  }

  async function openEvidence(id: string) {
    setEvidence(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/operations/reports/enrollments/${id}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.detail ?? "No fue posible abrir la evidencia.");
      setEvidence(payload as EnrollmentEvidence);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible abrir la evidencia.",
      );
    }
  }

  return (
    <div className="report-stack">
      <form className="filter-row report-filters" onSubmit={submit}>
        <label>
          Desde
          <input
            name="from"
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters({ ...filters, from: event.target.value })
            }
          />
        </label>
        <label>
          Hasta
          <input
            name="to"
            type="date"
            value={filters.to}
            onChange={(event) =>
              setFilters({ ...filters, to: event.target.value })
            }
          />
        </label>
        <label>
          Creador
          <select
            name="creator"
            value={filters.creator}
            onChange={(event) =>
              setFilters({ ...filters, creator: event.target.value })
            }
          >
            <option value="">Todos</option>
            {[1, 2, 3, 4, 5].map((number) => (
              <option
                key={number}
                value={`CR-${String(number).padStart(3, "0")}`}
              >
                CR-{String(number).padStart(3, "0")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Canal
          <select
            name="channel"
            value={filters.channel}
            onChange={(event) =>
              setFilters({ ...filters, channel: event.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="ctwa">CTWA</option>
            <option value="organic">Orgánico</option>
          </select>
        </label>
        <label>
          Estado
          <select
            name="state"
            value={filters.state}
            onChange={(event) =>
              setFilters({ ...filters, state: event.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="CA">California</option>
            <option value="TX">Texas</option>
            <option value="FL">Florida</option>
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Actualizando…" : "Aplicar filtros"}
        </button>
      </form>
      <p className="report-note">
        Fechas de leads según recepción ·{" "}
        {report?.filters.reporting_timezone ?? "America/New_York"}. Los totales
        del socio usan fecha de importación.
      </p>
      {error && (
        <section className="panel error-panel" role="alert">
          {error}
        </section>
      )}
      {!report && !error && (
        <section className="panel" aria-live="polite">
          Cargando métricas sintéticas…
        </section>
      )}
      {report && (
        <>
          <section className="report-grid" aria-label="Resumen operativo">
            <article className="metric-card">
              <span>Borradores pendientes</span>
              <strong>{report.backlog.pending_drafts}</strong>
            </article>
            <article className="metric-card">
              <span>Escalaciones abiertas</span>
              <strong>{report.backlog.open_escalations}</strong>
              <small>
                {report.backlog.breached_escalations} con vencimiento superado
              </small>
            </article>
            <article className="metric-card">
              <span>Entregas a socio</span>
              <strong>{report.delivery.logical_transfers}</strong>
              <small>
                {report.delivery.accepted} aceptadas · {report.delivery.pending}{" "}
                pendientes · {report.delivery.dead_letter} en DLQ
              </small>
            </article>
            <article className="metric-card">
              <span>Proxy potencialmente comisionable</span>
              <strong>{report.partner.potentially_commissionable}</strong>
              <small>No calcula dinero ni autoriza pagos.</small>
            </article>
          </section>

          <section className="report-panel">
            <h2>Funnel de leads</h2>
            <p>
              Conteos únicos por etapa. Cada conversión muestra su denominador
              inmediato y la proporción del cohorte recibido.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Conteo</th>
                    <th>Denominador</th>
                    <th>Conversión</th>
                    <th>Del cohorte recibido</th>
                  </tr>
                </thead>
                <tbody>
                  {report.funnel.lead_stages.map((stage) => (
                    <tr key={stage.stage}>
                      <th>{stageLabels[stage.stage] ?? stage.stage}</th>
                      <td>{stage.count}</td>
                      <td>{stage.denominator ?? "—"}</td>
                      <td>{percent(stage.conversion_percent)}</td>
                      <td>{percent(stage.received_cohort_percent ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-grid report-grid-two">
            <article className="report-panel">
              <h2>Decisiones y tiempos</h2>
              <ul className="metric-list">
                {Object.entries(report.decisions.distribution).map(
                  ([reason, count]) => (
                    <li key={reason}>
                      <span>{reason}</span>
                      <strong>{count}</strong>
                    </li>
                  ),
                )}
              </ul>
              <p>
                Primera decisión del sistema:{" "}
                {elapsed(
                  report.decisions.first_system_decision.median_seconds,
                  "seconds",
                )}{" "}
                mediana ({report.decisions.first_system_decision.samples}{" "}
                casos).
              </p>
              <p>
                Primera acción humana:{" "}
                {elapsed(
                  report.decisions.first_human_action.median_seconds,
                  "seconds",
                )}{" "}
                mediana ({report.decisions.first_human_action.samples} casos).
              </p>
            </article>
            <article className="report-panel">
              <h2>Inscripciones y calidad</h2>
              <div className="number-pair">
                <span>
                  Reportadas <strong>{report.partner.reported}</strong>
                </span>
                <span>
                  Conciliadas <strong>{report.partner.reconciled}</strong>
                </span>
              </div>
              <ul className="metric-list">
                <li>
                  <span>Exactas</span>
                  <strong>{report.partner.exact}</strong>
                </li>
                <li>
                  <span>Ambiguas</span>
                  <strong>{report.partner.ambiguous}</strong>
                </li>
                <li>
                  <span>En conflicto</span>
                  <strong>{report.partner.conflicting}</strong>
                </li>
                <li>
                  <span>Sin enlace</span>
                  <strong>{report.partner.unmatched}</strong>
                </li>
              </ul>
              <h3>Bloqueadores del proxy</h3>
              <ul className="metric-list">
                {Object.entries(report.partner.proxy_blockers).map(
                  ([key, count]) => (
                    <li key={key}>
                      <span>{key}</span>
                      <strong>{count}</strong>
                    </li>
                  ),
                )}
              </ul>
              <h3>Defectos de importación</h3>
              <ul className="metric-list">
                {Object.entries(report.partner.quality_issues).map(
                  ([key, count]) => (
                    <li key={key}>
                      <span>{key}</span>
                      <strong>{count}</strong>
                    </li>
                  ),
                )}
              </ul>
              <p className="report-note">{report.partner.scope_note}</p>
            </article>
          </section>

          <section className="report-panel">
            <h2>Trabajo estancado</h2>
            <p>
              Umbral y versión de regla se muestran junto a la edad. “Próximo”
              comienza al 80 %; callbacks, dentro de 15 minutos del horario.
            </p>
            {report.stalled.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Elemento</th>
                      <th>Motivo/etapa</th>
                      <th>Edad</th>
                      <th>Umbral</th>
                      <th>Estado</th>
                      <th>Responsable</th>
                      <th>Siguiente acción</th>
                      <th>Regla</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stalled.map((item) => (
                      <tr key={`${item.kind}-${item.entity_id}`}>
                        <td>{item.business_id ?? item.entity_id}</td>
                        <td>{item.reason}</td>
                        <td>{elapsed(item.age, item.age_unit)}</td>
                        <td>
                          {item.threshold} {item.threshold_unit}
                        </td>
                        <td>
                          <span className={`badge badge-${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          {item.owner_id ?? `Sin asignar · ${item.owner_role}`}
                        </td>
                        <td>{item.next_action}</td>
                        <td>v{item.rule_version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No hay trabajo estancado para los filtros seleccionados.</p>
            )}
            <div className="filter-row report-pagination">
              <span>
                {report.stalled_pagination.total === 0
                  ? "0 elementos"
                  : `${report.stalled_pagination.offset + 1}–${report.stalled_pagination.offset + report.stalled.length} de ${report.stalled_pagination.total}`}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={
                  busy || report.stalled_pagination.previous_offset === null
                }
                onClick={() =>
                  void navigateStalled(
                    report.stalled_pagination.previous_offset ?? 0,
                  )
                }
              >
                Anterior
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={
                  busy || report.stalled_pagination.next_offset === null
                }
                onClick={() =>
                  void navigateStalled(
                    report.stalled_pagination.next_offset ?? 0,
                  )
                }
              >
                Siguiente
              </button>
            </div>
          </section>

          <section className="report-panel">
            <h2>Trazabilidad de inscripciones</h2>
            {report.partner.evidence_links.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID del socio</th>
                      <th>Filas fuente</th>
                      <th>Estado</th>
                      <th>Bloqueos</th>
                      <th>Proxy</th>
                      <th>Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.partner.evidence_links.map((item) => (
                      <tr key={item.canonical_enrollment_id}>
                        <td>{item.partner_enrollment_id ?? "Sin ID"}</td>
                        <td>{item.source_row_numbers.join(", ")}</td>
                        <td>{item.status}</td>
                        <td>{item.conflict_flags.join(", ") || "—"}</td>
                        <td>{item.potentially_commissionable ? "Sí" : "No"}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              void openEvidence(item.canonical_enrollment_id)
                            }
                          >
                            Ver origen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Sin inscripciones dentro del rango.</p>
            )}
            {evidence && (
              <div className="evidence-card" aria-live="polite">
                <h3>
                  Origen canónico {evidence.partner_enrollment_id ?? "sin ID"}
                </h3>
                <p>
                  Filas: {evidence.source_row_numbers.join(", ") || "—"}.
                  Calidad:{" "}
                  {evidence.quality_issues.join(", ") ||
                    "sin defectos reportados"}
                  .
                </p>
                <p>
                  Estado: {evidence.reconciliation?.status ?? "sin caso"};
                  método:{" "}
                  {evidence.reconciliation?.match_method ??
                    "sin match automático"}
                  ; link comisionable:{" "}
                  {evidence.reconciliation?.potentially_commissionable
                    ? "sí"
                    : "no"}
                  .
                </p>
                <p>
                  Lead: {evidence.lead?.business_id ?? "sin enlace"}; canal:{" "}
                  {evidence.lead?.channel ?? "—"}; creador original:{" "}
                  {evidence.lead?.creator_business_id ?? "Sin atribución"}.
                </p>
                <ul>
                  {evidence.source_rows.map((row) => (
                    <li key={`${row.import_job_id}-${row.row_number}`}>
                      Fila {row.row_number} · checksum {row.row_checksum}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
