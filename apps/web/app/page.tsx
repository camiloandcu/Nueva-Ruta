export default function Home() {
  return (
    <main>
      <div className="eyebrow">Fundación local · WI-001</div>
      <h1>Nueva Ruta</h1>
      <p>
        Bandejas y controles para revisar leads, gestionar políticas y completar
        transferencias sintéticas con autorización humana.
      </p>
      <nav aria-label="Operaciones" className="operation-grid">
        <a href="/operations/review">Revisión de borradores</a>
        <a href="/operations/crm">CRM y transferencias</a>
        <a href="/operations/ai">Observabilidad de IA</a>
        <a href="/operations/partners">Importación y conciliación</a>
        <a href="/rules">Reglas</a>
      </nav>
    </main>
  );
}
