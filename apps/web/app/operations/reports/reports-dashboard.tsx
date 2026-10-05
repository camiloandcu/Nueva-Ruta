"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  channelLabel,
  reasonLabel,
  statusLabel,
} from "../../../lib/operational-labels";
import EnrollmentTraceItem, {
  type EnrollmentSummary,
} from "./enrollment-trace-item";

type FunnelStage = {
  stage: string;
  count: number;
  denominator: number | null;
  conversion_percent: number | null;
  received_cohort_percent?: number | null;
};
type StalledItem = {
  kind: string;
  entity_id: string;
  lead_id: string | null;
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
    evidence_links: EnrollmentSummary[];
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
type FilterOptions = {
  creators: string[];
  channels: string[];
  states: string[];
  can_open_crm: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(
    null,
  );
  const [filterOptionsError, setFilterOptionsError] = useState(false);
  const [visibleEnrollments, setVisibleEnrollments] = useState(8);

  const loadFilterOptions = useCallback(async () => {
    setFilterOptionsError(false);
    try {
      const response = await fetch("/api/operations/reports/filter-options", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Filter options unavailable");
      setFilterOptions((await response.json()) as FilterOptions);
    } catch {
      setFilterOptionsError(true);
    }
  }, []);

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
    void Promise.resolve().then(() => loadFilterOptions());
  }, [loadReport, loadFilterOptions]);

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
    setVisibleEnrollments(8);
    await loadReport(next);
  }

  async function navigateStalled(offset: number) {
    const next = { ...filters, stalled_offset: String(offset) };
    setFilters(next);
    await loadReport(next);
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
            {filterOptions?.creators.map((creator) => (
              <option key={creator} value={creator}>
                {creator}
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
            {filterOptions?.channels.map((channel) => (
              <option key={channel} value={channel}>
                {channelLabel(channel)}
              </option>
            ))}
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
            {filterOptions?.states.map((state) => (
              <option key={state} value={state}>
                {(
                  { CA: "California", TX: "Texas", FL: "Florida" } as Record<
                    string,
                    string
                  >
                )[state] ?? state}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Actualizando…" : "Aplicar filtros"}
        </button>
      </form>
      {filterOptionsError && (
        <p role="alert" className="report-note">
          No se pudieron cargar las opciones de filtro.{" "}
          <button type="button" onClick={() => void loadFilterOptions()}>
            Reintentar filtros
          </button>
        </p>
      )}
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
          Cargando métricas…
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
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Embudo de leads; desplázate horizontalmente para ver todas las columnas"
            >
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
                      <span>{reasonLabel(reason)}</span>
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
              <details className="report-detail-group">
                <summary>
                  Bloqueadores del proxy (
                  {Object.keys(report.partner.proxy_blockers).length})
                </summary>
                <ul className="metric-list">
                  {Object.entries(report.partner.proxy_blockers).map(
                    ([key, count]) => (
                      <li key={key}>
                        <span>{reasonLabel(key)}</span>
                        <strong>{count}</strong>
                      </li>
                    ),
                  )}
                </ul>
              </details>
              <details className="report-detail-group">
                <summary>
                  Defectos de importación (
                  {Object.keys(report.partner.quality_issues).length})
                </summary>
                <ul className="metric-list">
                  {Object.entries(report.partner.quality_issues).map(
                    ([key, count]) => (
                      <li key={key}>
                        <span>{reasonLabel(key)}</span>
                        <strong>{count}</strong>
                      </li>
                    ),
                  )}
                </ul>
              </details>
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
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Trabajo estancado; desplázate horizontalmente para ver todas las columnas"
              >
                <table className="stalled-table">
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
                        <td>
                          {filterOptions?.can_open_crm &&
                          item.lead_id &&
                          item.business_id ? (
                            <Link href={`/operations/crm?lead=${item.lead_id}`}>
                              {item.business_id} · Abrir caso
                            </Link>
                          ) : (
                            (item.business_id ?? item.entity_id)
                          )}
                        </td>
                        <td>{reasonLabel(item.reason)}</td>
                        <td>{elapsed(item.age, item.age_unit)}</td>
                        <td>
                          {item.threshold} {item.threshold_unit}
                        </td>
                        <td>
                          <span className={`badge badge-${item.status}`}>
                            {statusLabel(item.status)}
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
            <p>
              Origen, calidad y conciliación se muestran junto a cada
              inscripción.
            </p>
            {report.partner.evidence_links.length ? (
              <ol className="enrollment-trace-list">
                {report.partner.evidence_links
                  .slice(0, visibleEnrollments)
                  .map((item) => (
                    <EnrollmentTraceItem
                      key={item.canonical_enrollment_id}
                      item={item}
                      canOpenCrm={Boolean(filterOptions?.can_open_crm)}
                    />
                  ))}
              </ol>
            ) : (
              <p>Sin inscripciones dentro del rango.</p>
            )}
            {report.partner.evidence_links.length > visibleEnrollments && (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setVisibleEnrollments((count) => count + 8)}
              >
                Mostrar 8 inscripciones más ·{" "}
                {report.partner.evidence_links.length - visibleEnrollments}{" "}
                pendientes
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
