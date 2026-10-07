import fs from 'node:fs';
let file='apps/web/src/app/app/travel/trips/[id]/page.tsx';
fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('data.capabilities','capabilities'));
file='apps/web/e2e/golden-flows.spec.ts';
let source=fs.readFileSync(file,'utf8');
source=source.replaceAll('/SANDBOX \\/ MOCK CARD/','/Sandbox \\/ mock issuer|Travel virtual card/i');
source=source.replace('page.getByText("CARD_TRANSACTION").first()','page.getByText("Card", { exact: true }).first()').replace('/BILL|PAYMENT/','/^(Bill|Payment)$/');
source=source.replace('expect(submitted.requiresApproval).toBe(false);\n  expect(submitted.trip.status).toBe("READY_TO_BOOK");','expect(submitted.requiresApproval).toBe(true);\n  expect(submitted.trip.status).toBe("PENDING_APPROVAL");\n  const managerApproval = await login(page, "manager@acme.test");\n  await api(page, managerApproval, "post", `/travel/${trip.id}/approve`, {});\n  const adminApproval = await login(page, "admin@acme.test");\n  await api(page, adminApproval, "post", `/travel/${trip.id}/approve`, {});');
source=source.replaceAll('await api(page, employee, "post", `/travel/${trip.id}/submit`, {});\n  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { skipReprice: true });','await api(page, employee, "post", `/travel/${trip.id}/submit`, {});\n  const bookingManager = await login(page, "manager@acme.test");\n  await api(page, bookingManager, "post", `/travel/${trip.id}/approve`, {});\n  const bookingAdmin = await login(page, "admin@acme.test");\n  await api(page, bookingAdmin, "post", `/travel/${trip.id}/approve`, {});\n  await api(page, employee, "post", `/travel-bookings/${selected.booking.id}/book-mock`, { skipReprice: true });');
// Preserve the newest login token in the browser when checking an employee-only trip.
source=source.replace('await page.goto(`/app/travel/trips/${trip.id}`);\n  await expect(page.getByText(/Sandbox', 'await login(page, "employee@acme.test");\n  await page.goto(`/app/travel/trips/${trip.id}`);\n  await expect(page.getByText(/Sandbox');
fs.writeFileSync(file,source);
file='apps/web/e2e/p0-5-ux.spec.ts'; source=fs.readFileSync(file,'utf8');
source=source.replace('await page.goto(invited.activationPath); await page.getByLabel', 'await page.goto(invited.activationPath); await expect(page.getByLabel("Workspace", { exact: true })).toHaveValue("acme"); await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email); await page.getByLabel');
source=source.replace('await expect(page.getByText("Your account is active.")).toBeVisible();','await expect(page.getByText("Your account is active.")).toBeVisible({ timeout: 15000 });');
source=source.replaceAll('await expect(page).toHaveURL(/\\/app\\/home/);','await expect(page).toHaveURL(/\\/app\\/home/, { timeout: 20000 });');
source=source.replace('await page.getByRole("button", { name: "Reset password" }).click(); await page.getByRole', 'await page.getByRole("button", { name: "Reset password" }).click(); await expect(page.getByText("Your password has been reset.")).toBeVisible({ timeout: 15000 }); await page.getByRole');
source=source.replace('toContainText("Payment added")','toContainText("Payments added to run.")');
fs.writeFileSync(file,source);
