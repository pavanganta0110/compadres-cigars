// Usage: npm run admin:add-user -- name@example.com owner|manager|fulfillment|viewer
// Prompts for the password with no echo. Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local or the environment.
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

try { process.loadEnvFile(".env.local"); } catch {}
const [email, role] = process.argv.slice(2);
const ROLES = ["owner", "manager", "fulfillment", "viewer"];
if (!email || !ROLES.includes(role)) { console.error("Usage: npm run admin:add-user -- <email> <owner|manager|fulfillment|viewer>"); process.exit(1); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
console.log(`Target project: ${url}`);

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); else rl.output.write(""); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}
const db = createClient(url, key, { auth: { persistSession: false } });
const lower = email.toLowerCase();
let userId;
for (let page = 1; !userId; page++) {
  const { data: list, error: le } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (le) { console.error("Could not list users:", le.message); process.exit(1); }
  userId = list.users.find((u) => u.email?.toLowerCase() === lower)?.id;
  if (list.users.length < 200) break;
}
if (userId) {
  console.log("That user already exists; granting the role without changing the password.");
} else {
  const password = await askHidden("Password (min 12 characters): ");
  if (password.length < 12) { console.error("Password too short."); process.exit(1); }
  const { data, error } = await db.auth.admin.createUser({ email: lower, password, email_confirm: true });
  if (error) { console.error("Could not create user:", error.message); process.exit(1); }
  userId = data.user.id;
}
const { error: e2 } = await db.from("staff").upsert({ user_id: userId, role });
if (e2) { console.error("User created but staff row failed:", e2.message); process.exit(1); }
await db.from("audit_log").insert({ actor: "system", action: "staff.added", entity: "staff", entity_id: userId, detail: { role } });
console.log(`Added ${email} as ${role}.`);
