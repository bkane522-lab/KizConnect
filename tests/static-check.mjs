import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const required = [
  "index.html",
  "src/main.js",
  "src/api.js",
  "src/config.js",
  "src/supabaseClient.js",
  "src/styles.css",
  "public/manifest.webmanifest",
  "public/sw.js",
  "public/assets/kizconnect-symbol.png",
  "public/assets/kizconnect-logo.png",
  "supabase/migrations/001_kizconnect_v3.sql"
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Fichier manquant : ${file}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "3.1.1") failures.push("package.json n'est pas en version 3.1.1");

const main = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
const api = fs.readFileSync(path.join(root, "src/api.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/001_kizconnect_v3.sql"), "utf8");

for (const banned of ["UPSTASH", "Tickets", "ticket", "kc_me"]) {
  if ((main + api).includes(banned)) failures.push(`Ancien élément détecté dans le frontend : ${banned}`);
}

for (const expected of ["TROUVER UN PARTENAIRE", "COVOITURAGE", "MES MESSAGES", "kizconnect-symbol.png", "subscribeToMessages", "hideConversation", "blockUser", "reportUser"]) {
  if (!(main + api).includes(expected)) failures.push(`Fonction V3 absente : ${expected}`);
}

for (const expected of [
  "alter table public.messages enable row level security",
  "messages_member_insert",
  "training_owner_delete",
  "carpool_owner_delete",
  "start_conversation",
  "hide_conversation",
  "rate_limit_message",
  "storage.buckets",
  "supabase_realtime"
]) {
  if (!sql.includes(expected)) failures.push(`Protection SQL absente : ${expected}`);
}

if (failures.length) {
  console.error("KizConnect V3.1.1 — échec du contrôle statique:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("KizConnect V3.1.1 — contrôle statique OK.");
