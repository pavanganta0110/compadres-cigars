// Usage: node scripts/set-email.mjs .env.staging
// Prompts for the Resend API key (hidden), the From address and staff alert addresses, and writes them into the env file. Nothing is printed.
import fs from "node:fs";
import readline from "node:readline";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/set-email.mjs <env-file>"); process.exit(1); }
function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}
const key = await ask("Resend API key (hidden): ", true);
const from = await ask("From address, e.g. Compadres Cigars <orders@yourdomain.com>: ");
const admins = await ask("Staff alert emails (comma-separated): ");
const site = await ask("Site URL for links, e.g. https://your-site.vercel.app (Enter to skip): ");
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const list = admins.split(/[,;\s]+/).filter(Boolean);
if (key.length < 8 || !/^(?:[^<>@\r\n]{1,80} )?<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(from) || list.length === 0 || !list.every((a) => emailRe.test(a)) || (site && !/^https?:\/\/[^\s]+$/.test(site))) {
  console.error("Those values do not look right; nothing was written."); process.exit(1);
}
let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const set = (k, v) => { const re = new RegExp(`^${k}=.*$`, "m"); text = re.test(text) ? text.replace(re, () => `${k}=${v}`) : text + (text.endsWith("\n") || !text ? "" : "\n") + `${k}=${v}\n`; };
set("COMPADRES_EMAIL_PROVIDER", "resend");
set("COMPADRES_EMAIL_API_KEY", key);
set("COMPADRES_EMAIL_FROM", from);
set("COMPADRES_ADMIN_ALERT_EMAILS", list.join(","));
if (site) set("COMPADRES_SITE_URL", site.replace(/\/+$/, ""));
fs.writeFileSync(file, text, { mode: 0o600 });
console.log(`Saved to ${file}. Do not commit it. Set the same variables in Vercel (Settings > Environment Variables).`);
