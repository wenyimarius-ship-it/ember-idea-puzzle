export async function enterWorkspace(page) {
  await page.getByRole("button", { name: "试一组示例" }).click();
  await page.getByRole("button", { name: /01.*想改主页/ }).click();
  await page.getByRole("button", { name: /02.*不知道先改哪/ }).click();
  await page.getByRole("button", { name: "带走这一步" }).click();
  await page.getByRole("button", { name: "继续整理" }).click();
  await page.locator("#board").waitFor();
}
