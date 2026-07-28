import { copyFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2];
const sourceByTarget = {
  hosted: ".env.localsupabase",
  local: ".env.localdb",
};

if (!Object.hasOwn(sourceByTarget, target)) {
  throw new Error("Choose either `local` or `hosted`.");
}

const source = resolve(sourceByTarget[target]);
const destination = resolve(".env.local");

try {
  await stat(source);
} catch {
  throw new Error(`Missing ${sourceByTarget[target]}. Create it before switching.`);
}

await copyFile(source, destination);
console.log(`Activated ${sourceByTarget[target]}. Restart the dev server to apply it.`);
