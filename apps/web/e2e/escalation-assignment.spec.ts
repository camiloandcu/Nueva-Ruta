import { expect, test } from "@playwright/test";

async function signIn(
  page: import("@playwright/test").Page,
  role: "OPERATOR" | "SUPERVISOR",
) {
  const email = process.env[`DEMO_${role}_EMAIL`];
  const password = process.env[`DEMO_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`${role} credentials required`);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
}

test("operator can filter own cases and sees distinct urgent priority", async ({
  page,
}) => {
  await signIn(page, "OPERATOR");
  await page.goto("/operations/crm#escalations");
  const accessResponse = await page.request.get("/api/operations/crm/access");
  expect(accessResponse.ok()).toBeTruthy();
  const access = (await accessResponse.json()) as { id: string; role: string };
  expect(access.role).toBe("operator");
  await expect(page.locator(".queue-filter")).toBeVisible();
  await page.getByLabel("Ver casos").selectOption("mine");
  const ownCards = page.locator(".escalation-card");
  const escalationResponse = await page.request.get(
    "/api/operations/crm/escalations",
  );
  const escalations = (await escalationResponse.json()) as {
    owner_id: string | null;
    priority: string;
  }[];
  await expect(ownCards).toHaveCount(
    escalations.filter((item) => item.owner_id === access.id).length,
  );
  await expect(page.locator(".supervisor-actions")).toHaveCount(0);
  await page.getByLabel("Ver casos").selectOption("all");
  await expect(page.locator(".escalation-card")).toHaveCount(
    escalations.length,
  );
  const urgent = page
    .locator('.escalation-card[data-priority="urgent"]')
    .first();
  if (await urgent.count()) {
    const normal = page
      .locator('.escalation-card[data-priority="normal"]')
      .first();
    if (await normal.count()) {
      expect(
        await urgent.evaluate((el) => getComputedStyle(el).backgroundColor),
      ).not.toBe(
        await normal.evaluate((el) => getComputedStyle(el).backgroundColor),
      );
    }
  }
  await page.screenshot({
    path: "/tmp/influgain-escalations-operator.png",
    fullPage: true,
  });
});

test("supervisor confirms assignment explicitly without stretching adjacent cards", async ({
  page,
}) => {
  await signIn(page, "SUPERVISOR");
  await page.goto("/operations/crm#escalations");
  const teamResponse = await page.request.get("/api/operations/crm/team");
  const team = (await teamResponse.json()) as {
    id: string;
    display_name: string;
    role: string;
  }[];
  const operator = team.find((member) => member.role === "operator");
  expect(operator).toBeTruthy();
  const escalationResponse = await page.request.get(
    "/api/operations/crm/escalations",
  );
  const escalations = (await escalationResponse.json()) as {
    id: string;
    lifecycle_state: string;
    owner_id: string | null;
  }[];
  const target = escalations.find(
    (item) =>
      !["resolved", "closed_with_reason"].includes(item.lifecycle_state) &&
      item.owner_id !== operator?.id,
  );
  expect(target).toBeTruthy();
  const card = page.locator(
    `.escalation-card[data-escalation-id="${target?.id}"]`,
  );
  await expect(card).toBeVisible();
  const neighbor = page
    .locator(".escalation-card")
    .nth(escalations[0]?.id === target?.id ? 1 : 0);
  const heightBefore = (await neighbor.boundingBox())?.height;
  await card.getByText("Acciones de supervisión").click();
  expect((await neighbor.boundingBox())?.height).toBe(heightBefore);
  await page.screenshot({
    path: "/tmp/influgain-escalations-supervisor.png",
    fullPage: true,
  });
  await card.getByLabel("Asignar a").selectOption(operator?.id ?? "");
  await expect(card.locator(".escalation-meta dd").last()).not.toContainText(
    operator?.display_name ?? "",
  );
  await card.getByRole("button", { name: "Confirmar asignación" }).click();
  await expect(card.locator(".escalation-meta dd").last()).toContainText(
    operator?.display_name ?? "",
  );
  await expect(
    card.getByRole("button", { name: "Confirmar asignación" }),
  ).toBeDisabled();
});
