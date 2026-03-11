import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getServerRequire() {
  const serverPkgUrl = pathToFileURL(
    path.join(__dirname, "server", "package.json"),
  );
  return createRequire(serverPkgUrl);
}

async function loadEnv() {
  const serverRequire = getServerRequire();
  try {
    const dotenv = serverRequire("dotenv");
    dotenv.config({ path: path.join(__dirname, "server", ".env") });
  } catch (e) {
    void e;
  }
}

async function listSqlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client) {
  try {
    await client.query(
      `
        CREATE TABLE schema_migrations (
          name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `,
    );
  } catch (e) {
    if (String(e?.code || "") === "42P07") return;
    throw e;
  }
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    `SELECT name FROM schema_migrations ORDER BY applied_at ASC, name ASC`,
  );
  return rows.map((r) => String(r.name));
}

async function hasTable(client, tableName) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS reg`, [
    `public.${tableName}`,
  ]);
  return Boolean(rows?.[0]?.reg);
}

async function main() {
  await loadEnv();
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    process.stderr.write("Falta DATABASE_URL (usa server/.env)\n");
    process.exit(1);
  }

  const serverRequire = getServerRequire();
  const pg = serverRequire("pg");
  const { Client } = pg;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const isBootstrapped = await hasTable(client, "categories");
    process.stdout.write(`DB base: ${isBootstrapped ? "OK" : "VACÍA"}\n`);

    const migrationsDir = path.join(__dirname, "server", "db", "migrations");
    const migrationFiles = await listSqlFiles(migrationsDir);
    const applied = new Set(await getAppliedMigrations(client));

    const allNames = migrationFiles.map((f) => path.basename(f));
    const pending = allNames.filter((n) => !applied.has(n));

    process.stdout.write(`Migraciones encontradas: ${allNames.length}\n`);
    process.stdout.write(`Migraciones aplicadas: ${applied.size}\n`);
    process.stdout.write(`Migraciones pendientes: ${pending.length}\n`);
    if (pending.length) {
      for (const name of pending) process.stdout.write(`- ${name}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e?.message || e)}\n`);
  process.exit(1);
});
