"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Attempt = {
  id: number;
  correlation_id: string;
  lead_id: string;
  source_event_id: string;
  inbound_at: string;
  status: string;
  failure_layer: string;
  normalized_reason: string;
  provider: string;
  model: string;
  decision: string;
  reason_code: string;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  skipped_configuration: "Reglas deterministas",
  succeeded: "Asistencia completada",
  failed: "Fallo con respaldo",
  rejected: "Salida rechazada",
};
const decisionLabels: Record<string, string> = {
  respond: "Preparar respuesta",
  escalate_human: "Escalar a una persona",
  ignore: "No continuar contacto",
};

export default function AiTimeline() {
  const [items, setItems] = useState<Attempt[]>([]);
  const [correlation, setCorrelation] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (correlation) params.set("correlation_id", correlation);
    if (status) params.set("status", status);
    try {
      const response = await fetch("/api/operations/operations/ai?" + params, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "Esta vista requiere acceso de supervisor."
            : "No se pudieron cargar las ejecuciones.",
        );
      setItems((await response.json()) as Attempt[]);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar las ejecuciones.",
      );
    } finally {
      setLoading(false);
    }
  }, [correlation, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }
  return (
    <div className="workspace-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Trazabilidad de decisiones</span>
            <h2>Últimas ejecuciones</h2>
          </div>
          <span className="count-pill">{items.length}</span>
        </div>
        <p>
          Cada entrada conserva su decisión, razón y ruta de asistencia. Las
          reglas siguen procesando cuando el proveedor está deshabilitado o
          falla.
        </p>
        <form className="filter-row" onSubmit={submit}>
          <label>
            Correlación
            <input
              value={correlation}
              onChange={(event) => setCorrelation(event.target.value)}
            />
          </label>
          <label>
            Resultado
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="skipped_configuration">
                Reglas deterministas
              </option>
              <option value="succeeded">Asistencia completada</option>
              <option value="failed">Fallo con respaldo</option>
              <option value="rejected">Salida rechazada</option>
            </select>
          </label>
          <button>Filtrar</button>
        </form>
      </section>
      {error && (
        <section className="panel error-panel" role="alert">
          {error}
        </section>
      )}
      {loading && <section className="panel">Cargando ejecuciones…</section>}
      {!loading && !error && items.length === 0 && (
        <section className="panel">
          <h2>Sin resultados para este filtro</h2>
          <p>Prueba otro estado o procesa una entrada desde la bandeja.</p>
          <Link href="/operations/review">Ir a entradas →</Link>
        </section>
      )}
      {!error && items.length > 0 && (
        <ol className="execution-list">
          {items.map((item) => (
            <li key={item.id} className="panel execution-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">
                    {new Date(item.created_at).toLocaleString("es-US")}
                  </span>
                  <h2>{decisionLabels[item.decision] ?? item.decision}</h2>
                </div>
                <span className={"badge badge-" + item.status}>
                  {statusLabels[item.status] ?? item.status}
                </span>
              </div>
              <dl className="evidence-grid">
                <div>
                  <dt>Razón</dt>
                  <dd>{item.reason_code}</dd>
                </div>
                <div>
                  <dt>Estado de asistencia</dt>
                  <dd>{item.normalized_reason}</dd>
                </div>
                <div>
                  <dt>Capa</dt>
                  <dd>{item.failure_layer}</dd>
                </div>
                <div>
                  <dt>Proveedor</dt>
                  <dd>
                    {item.provider}
                    {item.model ? " · " + item.model : ""}
                  </dd>
                </div>
                <div>
                  <dt>Lead ID</dt>
                  <dd>
                    <code>{item.lead_id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Correlación</dt>
                  <dd>
                    <code>{item.correlation_id}</code>
                  </dd>
                </div>
              </dl>
              <Link
                href={
                  "/operations/review?lead=" + encodeURIComponent(item.lead_id)
                }
              >
                Abrir caso →
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
