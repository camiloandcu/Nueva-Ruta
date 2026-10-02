"use client";

import { useEffect, useState } from "react";

type Version = {
  id: string;
  version: number;
  content_hash: string;
  active: boolean;
  published_at: string;
};

type Draft = {
  id: string;
  content_hash: string;
  valid: boolean;
  validation_issues: Issue[];
};
type Issue = { code: string; path: string; message: string; severity: string };
type Change = { operation: string; path: string; old: unknown; new: unknown };

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail),
    );
  }
  return body as T;
}

export default function RuleReview() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [yaml, setYaml] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [message, setMessage] = useState("Cargando historial…");

  async function refresh() {
    const history = await jsonRequest<Version[]>("/api/rules/versions");
    setVersions(history);
    setMessage(
      history.length
        ? "Historial actualizado."
        : "No hay versiones publicadas.",
    );
  }

  useEffect(() => {
    jsonRequest<Version[]>("/api/rules/versions")
      .then((history) => {
        setVersions(history);
        setMessage(
          history.length
            ? "Historial actualizado."
            : "No hay versiones publicadas.",
        );
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function importYaml() {
    try {
      const imported = await jsonRequest<Draft>("/api/rules/drafts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml, source_name: "rule-review-editor.yaml" }),
      });
      const diff = await jsonRequest<{ changes: Change[]; duplicate: boolean }>(
        `/api/rules/drafts/${imported.id}/diff`,
      );
      setDraft(imported);
      setChanges(diff.changes);
      setMessage(
        imported.valid
          ? diff.duplicate
            ? "El borrador no contiene cambios materiales y no puede publicarse."
            : "Borrador válido. Revisa el diff y confirma su hash."
          : "La publicación está bloqueada por validaciones de cumplimiento.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo importar el YAML.",
      );
    }
  }

  async function publish() {
    if (!draft || !draft.valid || changes.length === 0) return;
    try {
      await jsonRequest(`/api/rules/drafts/${draft.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_hash: draft.content_hash,
          reason: "Revisión explícita en interfaz de gobernanza",
          correlation_id: `rule-review-${draft.id}`,
        }),
      });
      setDraft(null);
      setChanges([]);
      setMessage("Versión publicada y activada.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Publicación denegada; solo un supervisor puede confirmar.",
      );
    }
  }

  async function prepareRollback(version: Version) {
    try {
      const rollback = await jsonRequest<Draft>("/api/rules/rollback-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: version.id,
          reason: `Preparar restauración revisada desde v${version.version}`,
        }),
      });
      const diff = await jsonRequest<{ changes: Change[]; duplicate: boolean }>(
        `/api/rules/drafts/${rollback.id}/diff`,
      );
      setDraft(rollback);
      setChanges(diff.changes);
      setMessage(
        diff.duplicate
          ? "La versión elegida ya está activa; no hay rollback para publicar."
          : `Rollback desde v${version.version} preparado como un nuevo borrador.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Solo un supervisor puede preparar un rollback.",
      );
    }
  }

  return (
    <div className="rule-grid">
      <section className="panel">
        <h2>Versiones publicadas</h2>
        <ol className="history">
          {versions.map((version) => (
            <li key={version.id}>
              <strong>v{version.version}</strong>{" "}
              {version.active ? "· activa" : ""}
              <code>{version.content_hash.slice(0, 12)}</code>
              <a href={`/api/rules/versions/${version.id}/export`}>
                Exportar YAML
              </a>
              <button
                type="button"
                onClick={() => prepareRollback(version)}
                disabled={version.active}
              >
                Preparar rollback
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel">
        <h2>Importar borrador YAML</h2>
        <textarea
          aria-label="Documento de reglas YAML"
          value={yaml}
          onChange={(event) => setYaml(event.target.value)}
          placeholder="schema_version: 1"
          rows={16}
        />
        <button type="button" onClick={importYaml} disabled={!yaml.trim()}>
          Validar e importar
        </button>
        <p aria-live="polite">{message}</p>
        {draft?.validation_issues.map((issue) => (
          <p className="issue" key={`${issue.path}-${issue.code}`}>
            {issue.code} · {issue.path}: {issue.message}
          </p>
        ))}
      </section>
      {draft && (
        <section className="panel review-panel">
          <h2>Revisión previa a publicación</h2>
          <p>
            Hash confirmado: <code>{draft.content_hash}</code>
          </p>
          {changes.length ? (
            <table>
              <thead>
                <tr>
                  <th>Cambio</th>
                  <th>Ruta</th>
                  <th>Anterior</th>
                  <th>Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.path}>
                    <td>{change.operation}</td>
                    <td>
                      <code>{change.path}</code>
                    </td>
                    <td>{JSON.stringify(change.old)}</td>
                    <td>{JSON.stringify(change.new)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Sin cambios materiales.</p>
          )}
          <button
            type="button"
            onClick={publish}
            disabled={!draft.valid || !changes.length}
          >
            Confirmar hash y publicar como supervisor
          </button>
        </section>
      )}
    </div>
  );
}
