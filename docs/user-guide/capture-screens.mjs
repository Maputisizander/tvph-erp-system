// Capture product screenshots for the User Guide by driving the installed Edge
// via puppeteer-core. Usage:  node docs/user-guide/capture-screens.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.GUIDE_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.GUIDE_EMAIL || "test@user.com";
const PASSWORD = process.env.GUIDE_PASSWORD || "testuser";
const OUT = process.env.GUIDE_SHOTS_DIR; // absolute path
const EDGE =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

mkdirSync(OUT, { recursive: true });

const shots = [
  ["login", "/login", { pre: true }],
  ["dashboard", "/dashboard"],
  ["vendors", "/dashboard/vendors"],
  ["vendor-new", "/dashboard/vendors/new"],
  ["contracts", "/dashboard/vendors/contracts"],
  ["purchase-orders", "/dashboard/purchase-orders"],
  ["po-new", "/dashboard/purchase-orders/new"],
  ["invoices", "/dashboard/invoices"],
  ["invoice-new", "/dashboard/invoices/new"],
  ["accounting", "/dashboard/accounting"],
  ["crm", "/dashboard/crm"],
  ["crm-new", "/dashboard/crm/new"],
  ["client-pos", "/dashboard/client-pos"],
  ["client-invoices", "/dashboard/client-invoices"],
  ["projects", "/dashboard/projects"],
  ["documents", "/dashboard/documents"],
  ["hr", "/dashboard/hr"],
  ["assets", "/dashboard/assets"],
  ["reports", "/dashboard/reports"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1500,950"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
// Force the app into light theme so screenshots match the launch deck.
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem("theme", "light");
    localStorage.setItem("tvph-accent", "green");
  } catch {}
});

async function capture(name, path, opts = {}) {
  const url = BASE + path;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
  await sleep(1400); // let charts / realtime / fonts settle
  // Remove ONLY the floating AI chat widget: climb from the clippy image to its
  // nearest position:fixed ancestor (the small floating button) and remove that.
  // Never remove a large fixed wrapper (that would blank the page).
  await page.evaluate(() => {
    const img = document.querySelector('img[src*="clippy"]');
    if (!img) return;
    let n = img.parentElement;
    while (n && n !== document.body) {
      if (getComputedStyle(n).position === "fixed") {
        const r = n.getBoundingClientRect();
        if (r.width < 620 && r.height < 720) n.remove();
        break;
      }
      n = n.parentElement;
    }
    // Also strip the Next.js dev-mode indicator/overlay from the corner.
    document
      .querySelectorAll('nextjs-portal, [data-nextjs-dev-tools-button], #__next-build-watcher, [data-nextjs-toast]')
      .forEach((el) => el.remove());
  }).catch(() => {});
  await sleep(120);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("captured", name, "->", page.url());
}

// 1) Login page (pre-auth)
await capture("login", "/login", { pre: true });

// 2) Perform login
await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.waitForSelector('input[name="email"]', { timeout: 15000 });
await page.type('input[name="email"]', EMAIL, { delay: 15 });
await page.type('input[name="password"]', PASSWORD, { delay: 15 });
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
]);
await sleep(1500);
console.log("after login ->", page.url());

// 3) Capture the rest
for (const [name, path, opts] of shots) {
  if (name === "login") continue;
  await capture(name, path, opts);
}

await browser.close();
console.log("DONE");
