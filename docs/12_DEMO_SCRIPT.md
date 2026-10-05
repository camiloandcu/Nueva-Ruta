# Six-Minute Spanish-First Demo Script

## Before recording

- Run `make up`, `make verify`, `make reset`, and `make verify` again; use only seeded fictional data.
- Confirm the three demo identities can log in, AI mode is deterministic, and n8n workflows are active where the walkthrough needs them.
- Close terminal panes, password managers, provider dashboards, and unrelated tabs. Use a clean browser profile at readable zoom.
- Start recording only after the first screen is ready. Do not display `.env`, tokens, or real accounts.

## Timed narration (6:00 maximum)

| Time | Click path / action | Spanish narration |
| --- | --- | --- |
| 0:00–0:25 | Login as operator; show role-aware home. | “Nueva Ruta Ops conecta adquisición de creadores con operación y revisión humana. Todo lo que veremos es ficticio.” |
| 0:25–1:05 | Open lead inbox and a synthetic lead; show attribution and redacted message context. | “El origen se conserva desde el primer contacto. La información sensible se redacta y el sistema mantiene el contexto de consentimiento.” |
| 1:05–1:45 | Show triage outcome, safe draft, and escalation example. | “Las reglas deterministas deciden lo obvio; la asistencia solo propone. Un mensaje sustantivo siempre queda como borrador para una persona.” |
| 1:45–2:25 | Open n8n inbound workflow and one synthetic execution. | “n8n hace visible la orquestación y sus ramas. FastAPI sigue siendo la frontera de negocio y la fuente auditable está en Postgres.” |
| 2:25–3:10 | Review/approve a draft, then show a CRM disposition. | “La persona revisa el contenido y registra una disposición válida. Idempotencia y auditoría protegen las repeticiones.” |
| 3:10–3:55 | Show supervisor-approved transfer/retry or DLQ evidence. | “La transferencia exige aprobación explícita. El simulador permite observar éxito, reintento y recuperación sin un partner real.” |
| 3:55–4:35 | Open partner import/reconciliation; show one conflict. | “Los valores originales no se sobrescriben. Las coincidencias dudosas o contradictorias se envían a revisión, nunca se adivinan.” |
| 4:35–5:15 | Show funnel/creator content planning with source links. | “Los reportes preservan denominadores y atribución. Cada guion propuesto se vincula a evidencia y permanece pendiente de revisión.” |
| 5:15–5:45 | Show analyst-safe view or restricted action denial. | “Los roles se verifican en FastAPI, no solo en la interfaz. El analista recibe únicamente el detalle necesario.” |
| 5:45–6:00 | Return to home; show README or runtime status. | “La entrega es reproducible localmente, usa datos sintéticos y no pretende ser un servicio financiero en producción.” |

## Recording checklist

- [ ] El guion queda bajo seis minutos sin acelerar los controles de seguridad.
- [ ] No aparecen contraseñas, claves, variables secretas, datos personales ni mensajes sin redactar.
- [ ] Se ven al menos un flujo exitoso y un caso que requiere intervención humana.
- [ ] El rol de supervisor se usa solo para acciones autorizadas y el reset no se activa durante la grabación.
- [ ] Los paneles y resultados corresponden a la versión/commit registrado en la verificación final.
- [ ] Hosted demo, si sigue habilitada, está dentro del plazo/costo autorizado; de lo contrario usar el local.
