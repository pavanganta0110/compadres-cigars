// Usage: node scripts/set-quickbooks.mjs .env.staging
// Prompts for the Intuit app's client ID and secret (hidden) and the webhook verifier token (hidden), generates an
// encryption key for stored OAuth tokens, and writes them into the given env file. Nothing is printed.
import crypto from "node:crypto";
import fs from "node:fs";
import readline from "node:readline";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/set-quickbooks.mjs <env-file>"); process.exit(1); }

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}
const clientId = await ask("Intuit app client ID (sandbox): ");
const secret = await ask("Intuit app client secret (hidden): ", true);
const redirect = await ask("Redirect URI (e.g. https://YOUR-SITE/admin/payments/quickbooks/callback): ");
const verifier = await ask("Webhook verifier token (hidden, Enter to skip): ", true);
if (clientId.length < 8 || secret.length < 8 || !/^https:\/\/[^\s]+$|^http:\/\/localhost[:/][^\s]*$/.test(redirect)) { console.error("Those values do not look right; nothing was written."); process.exit(1); }

let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const has = (k) => new RegExp(`^${k}=.+$`, "m").test(text);
const set = (k, v) => { const re = new RegExp(`^${k}=.*$`, "m"); text = re.test(text) ? text.replace(re, () => `${k}=${v}`) : text + (text.endsWith("\n") || !text ? "" : "\n") + `${k}=${v}\n`; };
set("COMPADRES_PAYMENT_PROVIDER", "quickbooks");
set("COMPADRES_QUICKBOOKS_CLIENT_ID", clientId);
set("COMPADRES_QUICKBOOKS_CLIENT_SECRET", secret);
set("COMPADRES_QUICKBOOKS_REDIRECT_URI", redirect);
if (verifier) set("COMPADRES_QUICKBOOKS_WEBHOOK_VERIFIER", verifier);
if (!has("COMPADRES_TOKEN_ENCRYPTION_KEY")) set("COMPADRES_TOKEN_ENCRYPTION_KEY", crypto.randomBytes(32).toString("hex"));
fs.writeFileSync(file, text, { mode: 0o600 });
console.log(`Saved to ${file}. Do not commit it. Set the same variables in Vercel (Settings > Environment Variables).`);
