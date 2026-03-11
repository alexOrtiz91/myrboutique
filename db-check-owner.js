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
    const who = await client.query(`SELECT current_user AS u`);
    const currentUser = String(who.rows?.[0]?.u || "");
    process.stdout.write(`Usuario actual: ${currentUser}\n`);

    const { rows } = await client.query(
      `
        SELECT tablename AS table_name, tableowner AS table_owner
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename ASC
      `,
    );

    const notOwned = rows.filter((r) => String(r.table_owner) !== currentUser);
    process.stdout.write(`Tablas en public: ${rows.length}\n`);
    process.stdout.write(`No eres owner de: ${notOwned.length}\n`);
    for (const r of notOwned) {
      process.stdout.write(
        `- ${String(r.table_name)} (owner: ${String(r.table_owner)})\n`,
      );
    }

    if (notOwned.length) {
      process.stdout.write("\nPara correr ALTER TABLE (migraciones), necesitas OWNER o superuser.\n");
      process.stdout.write("Solución: corre migraciones con el owner, o pide cambiar OWNER.\n");
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e?.message || e)}\n`);
  process.exit(1);
});

