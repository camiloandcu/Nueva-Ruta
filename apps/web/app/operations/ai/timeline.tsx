"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Attempt = {
  id: number;
  correlation_id: string;
  status: string;
  failure_layer: string;
  normalized_reason: string;
  provider: string;
  model: string;
  created_at: string;
};

export default function AiTimeline() {
  const [items, setItems] = useState<Attempt[]>([]);
  const [correlation, setCorrelation] = useState("");
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (correlation) params.set("correlation_id", correlation);
    if (status) params.set("status", status);
    const response = await fetch(`/api/operations/operations/ai?${params}`, {
      cache: "no-store",
    });
    if (response.ok) setItems(await response.json());
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
    <section className="panel">
      <form className="filter-row" onSubmit={submit}>
        <label>
          Correlación{" "}
          <input
            value={correlation}
            onChange={(e) => setCorrelation(e.target.value)}
          />
        </label>
        <label>
          Estado{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option>skipped_configuration</option>
            <option>succeeded</option>
            <option>failed</option>
            <option>rejected</option>
          </select>
        </label>
        <button>Filtrar</button>
      </form>
      <ol className="timeline">
        {items.map((item) => (
          <li key={item.id}>
            <span className={`badge badge-${item.status}`}>{item.status}</span>
            <strong>
              {item.failure_layer} · {item.normalized_reason}
            </strong>
            <code>{item.correlation_id}</code>
            <small>
              {item.provider} {item.model}
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}
