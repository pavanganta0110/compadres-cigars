// Usage: node scripts/set-fedex.mjs .env.staging
// Prompts for the FedEx API key, secret (hidden) and account number, and writes them into the given env file. Nothing is printed.
import fs from "node:fs";
import readline from "node:readline";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/set-fedex.mjs <env-file>"); process.exit(1); }

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}
const clientId = await ask("FedEx API key (client ID): ");
const secret = await ask("FedEx secret key (hidden): ", true);
const account = (await ask("FedEx account number [740561073]: ")) || "740561073";
if (!/^[A-Za-z0-9._-]{10,128}$/.test(clientId) || secret.length < 8 || !/^\d{9}$/.test(account)) { console.error("Those values do not look right; nothing was written."); process.exit(1); }

let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const set = (k, v) => { const re = new RegExp(`^${k}=.*$`, "m"); text = re.test(text) ? text.replace(re, () => `${k}=${v}`) : text + (text.endsWith("\n") || !text ? "" : "\n") + `${k}=${v}\n`; };
set("COMPADRES_FEDEX_CLIENT_ID", clientId);
set("COMPADRES_FEDEX_CLIENT_SECRET", secret);
set("COMPADRES_FEDEX_ACCOUNT_NUMBER", account);
set("COMPADRES_FEDEX_API_BASE_URL", "https://apis-sandbox.fedex.com");
fs.writeFileSync(file, text, { mode: 0o600 });
console.log(`Saved to ${file}.`);
