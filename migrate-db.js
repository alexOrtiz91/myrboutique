import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Uso:",
      "  node migrate-db.js",
      "",
      "Variables:",
      "  DATABASE_URL=postgres://user:pass@host:5432/db",
      "",
      "Notas:",
      "  - Si existe server/.env, se carga automáticamente.",
      "  - Si la base está vacía, primero aplica server/db/schema.sql.",
      "  - Luego aplica server/db/migrations/*.sql en orden.",
      "",
    ].join("\n"),
  );
}

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
    const serverEnvPath = path.join(__dirname, "server", ".env");
    dotenv.config({ path: serverEnvPath });
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
    const code = String(e?.code || "");
    if (code === "42P07") return;
    throw e;
  }
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    `SELECT name FROM schema_migrations ORDER BY applied_at ASC, name ASC`,
  );
  return new Set(rows.map((r) => String(r.name)));
}

async function hasTable(client, tableName) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS reg`, [
    `public.${tableName}`,
  ]);
  return Boolean(rows?.[0]?.reg);
}

async function hasColumn(client, tableName, columnName) {
  const { rows } = await client.query(
    `
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName],
  );
  return Boolean(rows?.length);
}

async function applySqlFile(client, filePath) {
  const sql = await fs.readFile(filePath, "utf8");
  const name = path.basename(filePath);
  if (!sql.trim()) return { name, skipped: true };
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    const pgCode = String(e?.code || "");
    if (
      pgCode === "42501" ||
      String(e?.message || "").includes("must be owner of table")
    ) {
      const hintLines = [
        `Error aplicando ${name}: ${String(e?.message || e)}`,
        "",
        "Esto NO se arregla con código ni con GRANT: para ALTER TABLE necesitas ser OWNER (o superuser).",
        "Solución: ejecuta este script con una conexión que sea dueña de las tablas (DATABASE_URL con owner).",
        "",
        "Ejemplos:",
        "  DATABASE_URL='postgres://OWNER:PASS@HOST:5432/DB' npm run db:migrate",
        "",
        "Si quieres mantener tu usuario actual, un owner/superuser debe cambiar el dueño:",
        "  ALTER TABLE categories OWNER TO <tu_usuario>;",
        "  ALTER TABLE product_variants OWNER TO <tu_usuario>;",
        "",
      ];
      const err = new Error(hintLines.join("\n"));
      err.cause = e;
      throw err;
    }
    const err = new Error(
      `Error aplicando ${name}: ${String(e?.message || e)}`,
    );
    err.cause = e;
    throw err;
  }
  return { name, skipped: false };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  await loadEnv();
  const forceMigrations = new Set(
    String(process.env.DB_FORCE_MIGRATION || "")
      .split(",")
      .map((s) => String(s || "").trim())
      .filter(Boolean),
  );

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    process.stderr.write("Falta DATABASE_URL\n");
    printHelp();
    process.exit(1);
  }

  const serverRequire = getServerRequire();
  const pg = serverRequire("pg");
  const { Client } = pg;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const hasCategories = await hasTable(client, "categories");
    if (!hasCategories) {
      const schemaPath = path.join(__dirname, "server", "db", "schema.sql");
      const schemaSql = await fs.readFile(schemaPath, "utf8");
      await client.query("BEGIN");
      try {
        await client.query(schemaSql);
        await client.query("COMMIT");
        process.stdout.write("Aplicado: schema.sql\n");
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          void rollbackError;
        }
        const err = new Error(
          `Error aplicando schema.sql: ${String(e?.message || e)}`,
        );
        err.cause = e;
        throw err;
      }
    }

    const migrationsDir = path.join(__dirname, "server", "db", "migrations");
    const migrationFiles = await listSqlFiles(migrationsDir);
    if (!migrationFiles.length) {
      process.stdout.write(
        "No se encontraron migraciones en server/db/migrations\n",
      );
      return;
    }
    const applied = await getAppliedMigrations(client);

    process.stdout.write("Migraciones encontradas:\n");
    for (const f of migrationFiles)
      process.stdout.write(`- ${path.basename(f)}\n`);

    let appliedCount = 0;
    for (const filePath of migrationFiles) {
      const name = path.basename(filePath);
      const shouldForce = forceMigrations.has(name);
      if (!shouldForce && applied.has(name)) {
        if (name === "005_branches_drop_code.sql") {
          const codeStillExists = await hasColumn(client, "branches", "code");
          if (!codeStillExists) continue;
          await applySqlFile(client, filePath);
          process.stdout.write(`Reaplicada: ${name}\n`);
          continue;
        }
        continue;
      }
      await applySqlFile(client, filePath);
      if (!applied.has(name)) {
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [
          name,
        ]);
      }
      process.stdout.write(`Aplicado: ${name}\n`);
      appliedCount += 1;
    }

    if (appliedCount === 0)
      process.stdout.write("Sin migraciones pendientes\n");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e?.message || e)}\n`);
  process.exit(1);
});
