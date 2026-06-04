import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const PROD_URL = "https://crm-linkdin.vercel.app";
const SKIP_PREFIXES = ["SEED_"]; // seeding runs locally, not needed in prod

const raw = readFileSync(join(root, ".env.local"), "utf8");

const vars = {};
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue; // skip malformed lines
  const key = trimmed.slice(0, eq).trim();
  if (!/^[A-Z0-9_]+$/i.test(key)) continue;
  if (SKIP_PREFIXES.some((p) => key.startsWith(p))) continue;
  let value = trimmed.slice(eq + 1);
  // Strip a single pair of surrounding double quotes, keep literal \n inside.
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }
  vars[key] = value;
}

// Point tracking/unsubscribe links at the deployed domain.
vars.NEXT_PUBLIC_APP_URL = PROD_URL;

const keys = Object.keys(vars);
console.log(`Pushing ${keys.length} variables to Vercel (production):`);
console.log(keys.join(", "));

for (const key of keys) {
  // Remove existing value first (ignore failure if it doesn't exist).
  spawnSync("vercel", ["env", "rm", key, "production", "-y"], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  const res = spawnSync("vercel", ["env", "add", key, "production"], {
    input: vars[key],
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    console.error(`Failed to set ${key}`);
  } else {
    console.log(`Set ${key}`);
  }
}

console.log("\nDone. Now redeploy: vercel --prod");
