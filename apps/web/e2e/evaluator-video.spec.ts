import path from "node:path";

import { expect, test } from "@playwright/test";

test.skip(
  process.env.RECORD_EVALUATOR_VIDEO !== "1",
  "Run explicitly to record the evaluator walkthrough",
);

test("record the operator journey for evaluation", async ({ browser }) => {
  const email = process.env.DEMO_OPERATOR_EMAIL;
  const password = process.env.DEMO_OPERATOR_PASSWORD;
  if (!email || !password)
    throw new Error("Local operator credentials required");

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "test-results/evaluator-video",
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("heading", { name: "Bandeja" })).toBeVisible();
    await page.waitForTimeout(1200);

    await page.getByRole("link", { name: "Abrir Entrada" }).click();
    await page.getByRole("button", { name: "Ingresar mensaje" }).click();
    await expect(
      page.getByText("Entrada registrada y clasificada"),
    ).toBeVisible();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Aprobar sin entregar" }).click();
    await expect(page.getByText("Borrador aprobado y auditado")).toBeVisible();
    await page
      .getByRole("link", { name: "Continuar este caso en CRM" })
      .click();
    await expect(page).toHaveURL(/\/operations\/crm\?lead=/);
    await page
      .getByRole("button", { name: "Marcar como pre-calificado" })
      .click();
    await expect(page.getByText("Siguiente paso:")).toBeVisible();
    await page.waitForTimeout(1000);

    const evidence = page.getByRole("region", {
      name: "Mensajes aprobados del caso",
    });
    await evidence
      .getByRole("button", { name: "Registrar entrega simulada" })
      .click();
    await expect(
      evidence.getByText(/Entrega simulada registrada:/),
    ).toBeVisible();
    await page.getByLabel("Disposición").selectOption("Info Sent");
    await page
      .getByLabel("Motivo")
      .fill("Entrega simulada del recorrido de evaluación");
    await page.getByRole("button", { name: "Registrar disposición" }).click();
    await expect(page.getByRole("status")).toContainText("Información enviada");
    await page.waitForTimeout(1200);

    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Operación" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Escalaciones de toda la operación" }),
    ).toBeVisible();
    await page.waitForTimeout(1000);
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Resultados" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Trazabilidad de inscripciones" }),
    ).toBeVisible();
    await page
      .getByRole("heading", { name: "Trazabilidad de inscripciones" })
      .scrollIntoViewIfNeeded();
    await expect(
      page
        .locator(".enrollment-trace-item")
        .first()
        .getByText("Origen importado"),
    ).toBeVisible();
    await page.waitForTimeout(1400);
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Conciliación" })
      .click();
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForTimeout(1600);
  } finally {
    await context.close();
  }
  if (!video) throw new Error("Playwright did not record the journey");
  await video.saveAs(
    path.resolve(process.cwd(), "../../demo-flujo-completo.webm"),
  );
});
