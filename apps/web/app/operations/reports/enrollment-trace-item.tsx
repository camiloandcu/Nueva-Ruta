"use client";

import Link from "next/link";
import { useState } from "react";

import {
  channelLabel,
  reasonLabel,
  statusLabel,
} from "../../../lib/operational-labels";

export type EnrollmentSummary = {
  canonical_enrollment_id: string;
  partner_enrollment_id: string | null;
  status: string;
  match_method: string | null;
  conflict_flags: string[];
  quality_issues: string[];
  conflicted: boolean;
  source_row_numbers: number[];
  imported_at: string | null;
  lead_business_id: string | null;
  lead_crm_id: string | null;
  creator_business_id: string | null;
  channel: string | null;
  potentially_commissionable: boolean;
};

type AuditEvidence = {
  source_rows: {
    row_number: number;
    row_checksum: string;
    import_job_id: string;
  }[];
};

export default function EnrollmentTraceItem({
  item,
  canOpenCrm,
}: {
  item: EnrollmentSummary;
  canOpenCrm: boolean;
}) {
  const [audit, setAudit] = useState<AuditEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadAudit() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/operations/reports/enrollments/${item.canonical_enrollment_id}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Audit evidence unavailable");
      setAudit((await response.json()) as AuditEvidence);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="enrollment-trace-item">
      <div className="enrollment-trace-heading">
        <h3>{item.partner_enrollment_id ?? "Inscripción sin ID del socio"}</h3>
        <span className="badge">{statusLabel(item.status)}</span>
      </div>
      <dl className="enrollment-trace-facts">
        <div>
          <dt>Origen importado</dt>
          <dd>
            {item.imported_at
              ? new Date(item.imported_at).toLocaleDateString("es-CO")
              : "Fecha no disponible"}{" "}
            · filas {item.source_row_numbers.join(", ") || "sin número"}
          </dd>
        </div>
        <div>
          <dt>Calidad de origen</dt>
          <dd>
            {item.quality_issues.length
              ? item.quality_issues.map(reasonLabel).join(", ")
              : "Sin defectos reportados"}
          </dd>
        </div>
        <div>
          <dt>Conciliación</dt>
          <dd>
            {item.match_method
              ? reasonLabel(item.match_method)
              : "Sin enlace automático"}
            {item.conflicted ? " · datos en conflicto" : ""}
          </dd>
        </div>
        <div>
          <dt>Caso vinculado</dt>
          <dd>
            {item.lead_business_id && item.lead_crm_id && canOpenCrm ? (
              <Link href={`/operations/crm?lead=${item.lead_crm_id}`}>
                {item.lead_business_id} · Abrir caso
              </Link>
            ) : (
              (item.lead_business_id ?? "Sin caso vinculado")
            )}
          </dd>
        </div>
        <div>
          <dt>Atribución</dt>
          <dd>
            {item.creator_business_id ?? "Sin atribución"} ·{" "}
            {channelLabel(item.channel)}
          </dd>
        </div>
        <div>
          <dt>Proxy</dt>
          <dd>
            {item.potentially_commissionable
              ? "Potencialmente comisionable"
              : "No habilitado"}
          </dd>
        </div>
      </dl>
      {item.conflict_flags.length > 0 && (
        <p className="report-note">
          Bloqueos: {item.conflict_flags.map(reasonLabel).join(", ")}
        </p>
      )}
      <details
        className="enrollment-trace-audit"
        onToggle={(event) => {
          if (event.currentTarget.open && !audit && !loading && !error)
            void loadAudit();
        }}
      >
        <summary>Checksums de las filas de origen</summary>
        {loading && <p>Cargando datos de auditoría…</p>}
        {error && (
          <p role="alert">
            No se pudieron cargar los checksums.{" "}
            <button type="button" onClick={() => void loadAudit()}>
              Reintentar
            </button>
          </p>
        )}
        {audit && (
          <ul>
            {audit.source_rows.map((row) => (
              <li key={`${row.import_job_id}-${row.row_number}`}>
                Fila {row.row_number} · <code>{row.row_checksum}</code>
              </li>
            ))}
            {audit.source_rows.length === 0 && (
              <li>Sin checksums disponibles.</li>
            )}
          </ul>
        )}
      </details>
    </li>
  );
}
