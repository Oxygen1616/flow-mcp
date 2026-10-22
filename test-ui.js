import { getFlowPage } from "./dist/chrome.js";

async function main() {
  const page = await getFlowPage();
  const box = page.locator('div[aria-label="What do you want to create?"]').first();
  await box.click();
  await box.fill("Create a 9:16 vertical video: Cinematic comedy shot of three shipwrecked survivors on a tropical desert island beach, palm trees, sunny day, hilarious expressions");
  await page.waitForTimeout(1000);
  const startBtn = page.getByRole("button", { name: "Start generation" });
  console.log('Start generation enabled:', await startBtn.isEnabled());
  if (await startBtn.isEnabled()) {
    console.log('Clicking Start generation...');
    await startBtn.click();
    console.log('Generation started!');
  }
  process.exit(0);
}

main().catch(console.error);
