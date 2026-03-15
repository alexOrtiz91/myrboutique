import "dotenv/config";
import cors from "cors";
import express from "express";
import pg from "pg";

const app = express();

const corsOrigin = String(process.env.CORS_ORIGIN || "*").trim() || "*";
const corsAllowAll = corsOrigin === "*";
const corsAllowedOrigins = new Set(
  corsAllowAll
    ? []
    : corsOrigin
        .split(",")
        .map((s) => String(s || "").trim())
        .filter(Boolean),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsAllowAll) return callback(null, true);
      if (corsAllowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("not_allowed_by_cors"));
    },
  }),
);
app.use(express.json());

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

async function query(text, params) {
  if (!pool) {
    const err = new Error("DATABASE_URL is not set");
    err.code = "NO_DATABASE_URL";
    throw err;
  }
  return pool.query(text, params);
}

async function getNextNumericProductCode(run) {
  const r = await run(
    `
      SELECT
        (
          COALESCE(
            MAX(CASE WHEN code ~ '^[0-9]+$' THEN code::BIGINT END),
            999
          ) + 1
        ) AS next
      FROM product_variants
    `,
  );
  return String(r.rows?.[0]?.next || "").trim();
}

function toBranchCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function createBranchByName(run, name) {
  const safeName = String(name || "").trim();
  if (!safeName) throw new Error("invalid_branch_name");

  try {
    const created = await run(
      `
        INSERT INTO branches (name)
        VALUES ($1)
        RETURNING id, name
      `,
      [safeName],
    );
    return created.rows?.[0] || null;
  } catch (e) {
    const base = toBranchCode(safeName) || "main";
    for (let i = 0; i < 50; i += 1) {
      const candidate = i === 0 ? base : `${base}_${i + 1}`;
      try {
        const created = await run(
          `
            INSERT INTO branches (code, name)
            VALUES ($1, $2)
            RETURNING id, name
          `,
          [candidate, safeName],
        );
        return created.rows?.[0] || null;
      } catch (inner) {
        if (String(inner?.code || "") === "23505") continue;
        throw inner;
      }
    }
    throw e;
  }
}

function getBranchIdFromRequest(req) {
  const id = String(
    req.query?.branchId ||
      req.body?.branchId ||
      req.headers?.["x-branch-id"] ||
      "",
  ).trim();
  return id;
}

function getBranchNameFromRequest(req) {
  const name = String(
    req.query?.branchName ||
      req.body?.branchName ||
      req.headers?.["x-branch-name"] ||
      process.env.BRANCH_NAME ||
      "Sucursal Principal",
  ).trim();
  return name || "Sucursal Principal";
}

async function getBranchIdForRequest(client, req) {
  const requestedId = getBranchIdFromRequest(req);
  if (requestedId) {
    const existing = await client.query(
      `SELECT id FROM branches WHERE id = $1 LIMIT 1`,
      [requestedId],
    );
    if (existing.rows?.length) return existing.rows[0]?.id || null;
  }

  const requestedName = getBranchNameFromRequest(req);
  const existingByName = await client.query(
    `SELECT id FROM branches WHERE name = $1 LIMIT 1`,
    [requestedName],
  );
  if (existingByName.rows?.length) return existingByName.rows[0]?.id || null;

  const created = await createBranchByName(
    (text, params) => client.query(text, params),
    requestedName,
  );
  return created?.id || null;
}

function toCents(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function fromCents(cents) {
  const n = Number(cents ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/db/health", async (_req, res) => {
  try {
    const r = await query("SELECT 1 AS ok");
    res.json({ ok: true, db: r.rows?.[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/branches", async (_req, res) => {
  try {
    let { rows } = await query(
      `
        SELECT id, name
        FROM branches
        ORDER BY name ASC, created_at ASC
      `,
    );
    if (!rows.length) {
      const defaultName =
        String(process.env.BRANCH_NAME || "Sucursal Principal").trim() ||
        "Sucursal Principal";
      const created = await createBranchByName(query, defaultName);
      rows = created ? [created] : [];
    }
    res.json({
      branches: rows.map((r) => ({
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/branches", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "invalid_payload" });

    const existing = await query(
      `SELECT id, name FROM branches WHERE name = $1 LIMIT 1`,
      [name],
    );
    if (existing.rows?.length) {
      const r = existing.rows[0];
      return res.json({
        branch: {
          id: String(r.id || "").trim(),
          name: String(r.name || "").trim(),
        },
      });
    }

    const r = (await createBranchByName(query, name)) || {};
    res.json({
      branch: {
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.patch("/api/branches/:id", async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });
    if (!name) return res.status(400).json({ error: "invalid_payload" });

    const dup = await query(
      `SELECT 1 AS ok FROM branches WHERE name = $1 AND id <> $2 LIMIT 1`,
      [name, id],
    );
    if (dup.rows?.length) return res.status(409).json({ error: "duplicate" });

    const updated = await query(
      `UPDATE branches SET name = $2 WHERE id = $1 RETURNING id, name`,
      [id, name],
    );
    const r = updated.rows?.[0] || null;
    if (!r) return res.status(404).json({ error: "not_found" });
    res.json({ branch: { id: String(r.id || "").trim(), name: r.name } });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete("/api/branches/:id", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    await client.query("BEGIN");

    const has = await client.query(
      `SELECT 1 AS ok FROM inventory_counts WHERE branch_id = $1 AND qty > 0 LIMIT 1`,
      [id],
    );
    if (has.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "has_stock" });
    }

    await client.query(`DELETE FROM stock_movements WHERE branch_id = $1`, [
      id,
    ]);
    await client.query(`DELETE FROM inventory_counts WHERE branch_id = $1`, [
      id,
    ]);

    const deleted = await client.query(
      `DELETE FROM branches WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!deleted.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/size-profiles", async (_req, res) => {
  try {
    const profilesRes = await query(
      `
        SELECT id, label, genero
        FROM size_profiles
        WHERE active = TRUE
        ORDER BY label ASC, created_at ASC
      `,
    );
    const profileIds = profilesRes.rows.map((r) => r.id);
    if (!profileIds.length) return res.json({ profiles: [] });

    const valuesRes = await query(
      `
        SELECT profile_id, value
        FROM size_profile_values
        WHERE profile_id = ANY($1)
        ORDER BY profile_id ASC, sort_order ASC, created_at ASC
      `,
      [profileIds],
    );

    const valuesByProfileId = {};
    for (const r of valuesRes.rows) {
      const id = String(r.profile_id);
      if (!valuesByProfileId[id]) valuesByProfileId[id] = [];
      valuesByProfileId[id].push(String(r.value));
    }

    res.json({
      profiles: profilesRes.rows.map((r) => ({
        id: r.id,
        label: r.label,
        genero: r.genero || "",
        values: valuesByProfileId[String(r.id)] || [],
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/size-profiles", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");

    const id = String(req.body?.id || "").trim();
    const label = String(req.body?.label || "").trim();
    const genero = String(req.body?.genero || "").trim();
    const values = Array.isArray(req.body?.values)
      ? req.body.values.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    if (!id || !label)
      return res.status(400).json({ error: "invalid_payload" });

    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO size_profiles (id, label, genero, active)
        VALUES ($1, $2, $3, TRUE)
      `,
      [id, label, genero || null],
    );
    for (let i = 0; i < values.length; i += 1) {
      await client.query(
        `
          INSERT INTO size_profile_values (profile_id, value, sort_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (profile_id, value) DO NOTHING
        `,
        [id, values[i], i + 1],
      );
    }
    await client.query("COMMIT");

    res.json({
      profile: { id, label, genero: genero || "", values },
    });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.patch("/api/size-profiles/:id", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const body = req.body || {};
    const hasLabel = Object.prototype.hasOwnProperty.call(body, "label");
    const hasGenero = Object.prototype.hasOwnProperty.call(body, "genero");
    const hasValues = Object.prototype.hasOwnProperty.call(body, "values");

    const label = hasLabel ? String(body.label ?? "").trim() : null;
    const genero = hasGenero ? String(body.genero ?? "").trim() : null;
    const valuesRaw = hasValues ? body.values : null;
    const values = Array.isArray(valuesRaw)
      ? valuesRaw.map((v) => String(v || "").trim()).filter(Boolean)
      : null;

    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id FROM size_profiles WHERE id = $1 AND active = TRUE`,
      [id],
    );
    if (!existing.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }

    if (label !== null || genero !== null) {
      await client.query(
        `
          UPDATE size_profiles
          SET label = COALESCE($2, label),
              genero = COALESCE($3, genero)
          WHERE id = $1
        `,
        [id, label, genero === "" ? null : genero],
      );
    }

    if (values !== null) {
      await client.query(
        `DELETE FROM size_profile_values WHERE profile_id = $1`,
        [id],
      );
      for (let i = 0; i < values.length; i += 1) {
        await client.query(
          `
            INSERT INTO size_profile_values (profile_id, value, sort_order)
            VALUES ($1, $2, $3)
            ON CONFLICT (profile_id, value)
            DO UPDATE SET sort_order = EXCLUDED.sort_order
          `,
          [id, values[i], i + 1],
        );
      }
    }

    const profileRes = await client.query(
      `SELECT id, label, genero FROM size_profiles WHERE id = $1`,
      [id],
    );
    const valuesRes = await client.query(
      `
        SELECT value
        FROM size_profile_values
        WHERE profile_id = $1
        ORDER BY sort_order ASC, created_at ASC
      `,
      [id],
    );

    await client.query("COMMIT");
    const r = profileRes.rows[0];
    res.json({
      profile: {
        id: r.id,
        label: r.label,
        genero: r.genero || "",
        values: valuesRes.rows.map((v) => String(v.value)),
      },
    });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/size-profiles/:id/rename-value", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const id = String(req.params?.id || "").trim();
    const from = String(req.body?.from || "").trim();
    const to = String(req.body?.to || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });
    if (!from || !to) return res.status(400).json({ error: "invalid_payload" });

    if (from === to) {
      const valuesRes = await client.query(
        `
          SELECT value
          FROM size_profile_values
          WHERE profile_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
        [id],
      );
      return res.json({
        profileId: id,
        values: valuesRes.rows.map((v) => v.value),
      });
    }

    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id FROM size_profiles WHERE id = $1 AND active = TRUE`,
      [id],
    );
    if (!existing.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }

    const toExists = await client.query(
      `SELECT 1 AS ok FROM size_profile_values WHERE profile_id = $1 AND value = $2 LIMIT 1`,
      [id, to],
    );
    if (toExists.rows?.length) {
      await client.query(
        `DELETE FROM size_profile_values WHERE profile_id = $1 AND value = $2`,
        [id, from],
      );
    } else {
      await client.query(
        `UPDATE size_profile_values SET value = $3 WHERE profile_id = $1 AND value = $2`,
        [id, from, to],
      );
    }

    await client.query(
      `
        UPDATE product_variants pv
        SET talla = $3
        FROM categories c
        WHERE c.id = pv.category_id
          AND c.size_profile_id = $1
          AND pv.talla = $2
          AND pv.active = TRUE
      `,
      [id, from, to],
    );

    const valuesRes = await client.query(
      `
        SELECT value
        FROM size_profile_values
        WHERE profile_id = $1
        ORDER BY sort_order ASC, created_at ASC
      `,
      [id],
    );

    await client.query("COMMIT");
    res.json({
      profileId: id,
      values: valuesRes.rows.map((v) => String(v.value)),
    });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.delete("/api/size-profiles/:id", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const id = String(req.params?.id || "").trim();
    const fallbackId = String(req.body?.fallbackId || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });
    if (!fallbackId) return res.status(400).json({ error: "invalid_fallback" });
    if (id === fallbackId)
      return res.status(400).json({ error: "invalid_fallback" });

    await client.query("BEGIN");
    const activeCountRes = await client.query(
      `SELECT COUNT(*)::int AS c FROM size_profiles WHERE active = TRUE`,
    );
    const activeCount = Number(activeCountRes.rows?.[0]?.c ?? 0);
    if (activeCount <= 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "cannot_delete_last_profile" });
    }

    const fallbackRes = await client.query(
      `SELECT id FROM size_profiles WHERE id = $1 AND active = TRUE`,
      [fallbackId],
    );
    if (!fallbackRes.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "fallback_not_found" });
    }

    const targetRes = await client.query(
      `SELECT id FROM size_profiles WHERE id = $1 AND active = TRUE`,
      [id],
    );
    if (!targetRes.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }

    await client.query(
      `UPDATE categories SET size_profile_id = $2 WHERE size_profile_id = $1`,
      [id, fallbackId],
    );
    await client.query(
      `UPDATE size_profiles SET active = FALSE WHERE id = $1`,
      [id],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/separator-sizes", async (_req, res) => {
  try {
    const { rows } = await query(
      `
        SELECT
          id,
          name,
          lines,
          font_size_mm,
          line_gap_mm,
          y_offset_mm,
          side_offset_mm,
          letter_spacing_mm
        FROM separator_sizes
        ORDER BY name ASC, created_at ASC
      `,
    );
    res.json({
      sizes: rows.map((r) => ({
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
        lines: Array.isArray(r.lines)
          ? r.lines.map((v) => String(v || "").trim())
          : [],
        fontSizeMm: Number(r.font_size_mm ?? 12),
        lineGapMm: Number(r.line_gap_mm ?? 5),
        yOffsetMm: Number(r.y_offset_mm ?? 0),
        sideOffsetMm: Number(r.side_offset_mm ?? 0),
        letterSpacingMm: Number(r.letter_spacing_mm ?? 0),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/separator-sizes", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "invalid_payload" });

    const bodyLines = req.body?.lines;
    const normalizeToken = (t) => {
      const v = String(t || "").trim();
      if (!v) return "";
      if (v === "-" || v === "–" || v === "—" || v === "−") return "−";
      return v;
    };
    const looksNumeric = (s) => /^\d/.test(String(s || "").trim());
    const rawLines = Array.isArray(bodyLines)
      ? bodyLines.map((v) => String(v || "").trim()).filter(Boolean)
      : bodyLines === undefined || bodyLines === null
        ? [name]
        : String(bodyLines || "")
            .split("\n")
            .map((v) => String(v || "").trim())
            .filter(Boolean);
    let lines = rawLines.map(normalizeToken).filter(Boolean);
    if (
      lines.length === 2 &&
      looksNumeric(lines[0]) &&
      looksNumeric(lines[1])
    ) {
      lines = [lines[0], "−", lines[1]];
    }
    const fontSizeMm = Number(req.body?.fontSizeMm);
    const lineGapMm = Number(req.body?.lineGapMm);
    const yOffsetMm = Number(req.body?.yOffsetMm);
    const sideOffsetMm = Number(req.body?.sideOffsetMm);
    const letterSpacingMm = Number(req.body?.letterSpacingMm);

    const { rows } = await query(
      `
        INSERT INTO separator_sizes (
          name,
          lines,
          font_size_mm,
          line_gap_mm,
          y_offset_mm,
          side_offset_mm,
          letter_spacing_mm
        )
        VALUES (
          $1,
          $2,
          COALESCE($3, 12::numeric),
          COALESCE($4, 5::numeric),
          COALESCE($5, 0::numeric),
          COALESCE($6, 0::numeric),
          COALESCE($7, 0::numeric)
        )
        RETURNING
          id,
          name,
          lines,
          font_size_mm,
          line_gap_mm,
          y_offset_mm,
          side_offset_mm,
          letter_spacing_mm
      `,
      [
        name,
        lines.length ? lines : [name],
        Number.isFinite(fontSizeMm) ? fontSizeMm : null,
        Number.isFinite(lineGapMm) ? lineGapMm : null,
        Number.isFinite(yOffsetMm) ? yOffsetMm : null,
        Number.isFinite(sideOffsetMm) ? sideOffsetMm : null,
        Number.isFinite(letterSpacingMm) ? letterSpacingMm : null,
      ],
    );

    const r = rows[0] || {};
    res.json({
      size: {
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
        lines: Array.isArray(r.lines)
          ? r.lines.map((v) => String(v || "").trim())
          : [],
        fontSizeMm: Number(r.font_size_mm ?? 12),
        lineGapMm: Number(r.line_gap_mm ?? 5),
        yOffsetMm: Number(r.y_offset_mm ?? 0),
        sideOffsetMm: Number(r.side_offset_mm ?? 0),
        letterSpacingMm: Number(r.letter_spacing_mm ?? 0),
      },
    });
  } catch (e) {
    if (String(e?.code || "") === "23505")
      return res.status(409).json({ error: "duplicate_name" });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.patch("/api/separator-sizes/:id", async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const body = req.body || {};
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasLines = Object.prototype.hasOwnProperty.call(body, "lines");
    const hasFontSizeMm = Object.prototype.hasOwnProperty.call(
      body,
      "fontSizeMm",
    );
    const hasLineGapMm = Object.prototype.hasOwnProperty.call(
      body,
      "lineGapMm",
    );
    const hasYOffsetMm = Object.prototype.hasOwnProperty.call(
      body,
      "yOffsetMm",
    );
    const hasSideOffsetMm = Object.prototype.hasOwnProperty.call(
      body,
      "sideOffsetMm",
    );
    const hasLetterSpacingMm = Object.prototype.hasOwnProperty.call(
      body,
      "letterSpacingMm",
    );

    const name = hasName ? String(body.name || "").trim() : null;
    if (hasName && !name)
      return res.status(400).json({ error: "invalid_name" });

    const normalizeToken = (t) => {
      const v = String(t || "").trim();
      if (!v) return "";
      if (v === "-" || v === "–" || v === "—" || v === "−") return "−";
      return v;
    };
    const looksNumeric = (s) => /^\d/.test(String(s || "").trim());
    const bodyLines = hasLines ? body.lines : null;
    const rawLines =
      bodyLines === null
        ? null
        : Array.isArray(bodyLines)
          ? bodyLines.map((v) => String(v || "").trim()).filter(Boolean)
          : bodyLines === undefined
            ? null
            : String(bodyLines || "")
                .split("\n")
                .map((v) => String(v || "").trim())
                .filter(Boolean);
    let lines =
      rawLines === null ? null : rawLines.map(normalizeToken).filter(Boolean);
    if (
      lines &&
      lines.length === 2 &&
      looksNumeric(lines[0]) &&
      looksNumeric(lines[1])
    ) {
      lines = [lines[0], "−", lines[1]];
    }

    const fontSizeMm = hasFontSizeMm ? Number(body.fontSizeMm) : null;
    const lineGapMm = hasLineGapMm ? Number(body.lineGapMm) : null;
    const yOffsetMm = hasYOffsetMm ? Number(body.yOffsetMm) : null;
    const sideOffsetMm = hasSideOffsetMm ? Number(body.sideOffsetMm) : null;
    const letterSpacingMm = hasLetterSpacingMm
      ? Number(body.letterSpacingMm)
      : null;

    const existing = await query(
      `SELECT id, name FROM separator_sizes WHERE id = $1 LIMIT 1`,
      [id],
    );
    const existingName = String(existing.rows?.[0]?.name || "").trim();
    if (!existing.rows?.length || !existingName)
      return res.status(404).json({ error: "not_found" });

    const { rows } = await query(
      `
        UPDATE separator_sizes
        SET name = COALESCE($2, name),
            lines = COALESCE($3, lines),
            font_size_mm = COALESCE($4, font_size_mm),
            line_gap_mm = COALESCE($5, line_gap_mm),
            y_offset_mm = COALESCE($6, y_offset_mm),
            side_offset_mm = COALESCE($7, side_offset_mm),
            letter_spacing_mm = COALESCE($8, letter_spacing_mm),
            updated_at = now()
        WHERE id = $1
        RETURNING
          id,
          name,
          lines,
          font_size_mm,
          line_gap_mm,
          y_offset_mm,
          side_offset_mm,
          letter_spacing_mm
      `,
      [
        id,
        name,
        lines ? (lines.length ? lines : [name || existingName]) : null,
        Number.isFinite(fontSizeMm) ? fontSizeMm : null,
        Number.isFinite(lineGapMm) ? lineGapMm : null,
        Number.isFinite(yOffsetMm) ? yOffsetMm : null,
        Number.isFinite(sideOffsetMm) ? sideOffsetMm : null,
        Number.isFinite(letterSpacingMm) ? letterSpacingMm : null,
      ],
    );

    const r = rows[0] || {};
    res.json({
      size: {
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
        lines: Array.isArray(r.lines)
          ? r.lines.map((v) => String(v || "").trim())
          : [],
        fontSizeMm: Number(r.font_size_mm ?? 12),
        lineGapMm: Number(r.line_gap_mm ?? 5),
        yOffsetMm: Number(r.y_offset_mm ?? 0),
        sideOffsetMm: Number(r.side_offset_mm ?? 0),
        letterSpacingMm: Number(r.letter_spacing_mm ?? 0),
      },
    });
  } catch (e) {
    if (String(e?.code || "") === "23505")
      return res.status(409).json({ error: "duplicate_name" });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete("/api/separator-sizes/:id", async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const deleted = await query(
      `DELETE FROM separator_sizes WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!deleted.rows?.length)
      return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/catalog/categories", async (_req, res) => {
  try {
    const { rows } = await query(
      `
        SELECT id, name, price_cents, wholesale_price_cents, credit_price_cents, size_profile_id
        FROM categories
        WHERE active = TRUE
        ORDER BY name ASC
      `,
    );
    res.json({
      categories: rows.map((r) => ({
        id: r.id,
        name: r.name,
        price: fromCents(r.price_cents),
        wholesalePrice: fromCents(r.wholesale_price_cents),
        creditPrice: fromCents(r.credit_price_cents),
        sizeProfileId: r.size_profile_id || null,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/catalog/categories", async (req, res) => {
  try {
    const id = String(req.body?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    const price = toCents(req.body?.price);
    const wholesalePrice = toCents(req.body?.wholesalePrice);
    const creditPrice =
      req.body?.creditPrice === undefined ||
      req.body?.creditPrice === null ||
      req.body?.creditPrice === ""
        ? price
        : toCents(req.body?.creditPrice);
    const sizeProfileId = String(req.body?.sizeProfileId || "").trim() || null;

    if (!id || !name) return res.status(400).json({ error: "invalid_payload" });

    const { rows } = await query(
      `
        INSERT INTO categories (id, name, price_cents, wholesale_price_cents, credit_price_cents, size_profile_id, active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id, name, price_cents, wholesale_price_cents, credit_price_cents, size_profile_id
      `,
      [id, name, price, wholesalePrice, creditPrice, sizeProfileId],
    );

    const r = rows[0];
    res.json({
      category: {
        id: r.id,
        name: r.name,
        price: fromCents(r.price_cents),
        wholesalePrice: fromCents(r.wholesale_price_cents),
        creditPrice: fromCents(r.credit_price_cents),
        sizeProfileId: r.size_profile_id || null,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.patch("/api/catalog/categories/:id", async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const name = String(req.body?.name || "").trim();
    const price = toCents(req.body?.price);
    const wholesalePrice = toCents(req.body?.wholesalePrice);
    const creditPrice =
      req.body?.creditPrice === undefined ||
      req.body?.creditPrice === null ||
      req.body?.creditPrice === ""
        ? price
        : toCents(req.body?.creditPrice);
    const sizeProfileId = String(req.body?.sizeProfileId || "").trim() || null;

    const { rows } = await query(
      `
        UPDATE categories
        SET name = $2,
            price_cents = $3,
            wholesale_price_cents = $4,
            credit_price_cents = $5,
            size_profile_id = $6
        WHERE id = $1
        RETURNING id, name, price_cents, wholesale_price_cents, credit_price_cents, size_profile_id
      `,
      [id, name, price, wholesalePrice, creditPrice, sizeProfileId],
    );

    const r = rows[0];
    if (!r) return res.status(404).json({ error: "not_found" });
    res.json({
      category: {
        id: r.id,
        name: r.name,
        price: fromCents(r.price_cents),
        wholesalePrice: fromCents(r.wholesale_price_cents),
        creditPrice: fromCents(r.credit_price_cents),
        sizeProfileId: r.size_profile_id || null,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete("/api/catalog/categories/:id", async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });
    const r = await query(
      `UPDATE categories SET active = FALSE WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!r.rows?.length) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/catalog/products", async (_req, res) => {
  try {
    const { rows } = await query(
      `
        SELECT code, category_id, talla
        FROM product_variants
        WHERE active = TRUE
        ORDER BY code ASC
      `,
    );
    res.json({
      products: rows.map((r) => ({
        code: r.code,
        categoryId: r.category_id,
        talla: r.talla,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/catalog/products", async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    const categoryId = String(req.body?.categoryId || "").trim();
    const talla = String(req.body?.talla || "").trim();
    if (!categoryId || !talla)
      return res.status(400).json({ error: "invalid_payload" });

    const dup = await query(
      `
        SELECT 1 AS ok
        FROM product_variants
        WHERE active = TRUE
          AND category_id = $1
          AND talla = $2
        LIMIT 1
      `,
      [categoryId, talla],
    );
    if (dup.rows?.length)
      return res.status(409).json({ error: "duplicate_variant" });

    let candidate = code || (await getNextNumericProductCode(query));
    let rows = null;
    for (let i = 0; i < 20; i += 1) {
      try {
        const inserted = await query(
          `
            INSERT INTO product_variants (code, category_id, talla, active)
            VALUES ($1, $2, $3, TRUE)
            RETURNING code, category_id, talla
          `,
          [candidate, categoryId, talla],
        );
        rows = inserted.rows;
        break;
      } catch (e) {
        const isUnique = String(e?.code || "") === "23505";
        const isBarcodeConstraint =
          String(e?.constraint || "") === "product_variants_code_key";
        if (!isUnique || !isBarcodeConstraint) throw e;
        candidate = await getNextNumericProductCode(query);
      }
    }
    if (!rows?.length) throw new Error("code_generation_failed");

    const r = rows[0];
    res.json({
      product: { code: r.code, categoryId: r.category_id, talla: r.talla },
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.patch("/api/catalog/products/:code", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const code = String(req.params?.code || "").trim();
    if (!code) return res.status(400).json({ error: "invalid_code" });

    const categoryId = String(req.body?.categoryId || "").trim();
    const talla = String(req.body?.talla || "").trim();
    if (!categoryId || !talla)
      return res.status(400).json({ error: "invalid_payload" });

    await client.query("BEGIN");

    const pvRes = await client.query(
      `
        SELECT id, category_id, talla
        FROM product_variants
        WHERE code = $1 AND active = TRUE
        LIMIT 1
      `,
      [code],
    );
    const pv = pvRes.rows[0] || null;
    if (!pv) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }

    const stockRes = await client.query(
      `
        SELECT 1 AS ok
        FROM inventory_counts
        WHERE product_variant_id = $1 AND qty > 0
        LIMIT 1
      `,
      [pv.id],
    );
    const hasStock = Boolean(stockRes.rows?.length);
    const isChanging = pv.category_id !== categoryId || pv.talla !== talla;
    if (hasStock && isChanging) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "has_stock" });
    }

    const dup = await client.query(
      `
        SELECT 1 AS ok
        FROM product_variants
        WHERE active = TRUE
          AND category_id = $1
          AND talla = $2
          AND code <> $3
        LIMIT 1
      `,
      [categoryId, talla, code],
    );
    if (dup.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "duplicate_variant" });
    }

    const updated = await client.query(
      `
        UPDATE product_variants
        SET category_id = $2,
            talla = $3
        WHERE code = $1 AND active = TRUE
        RETURNING code, category_id, talla
      `,
      [code, categoryId, talla],
    );

    await client.query("COMMIT");
    const r = updated.rows[0];
    res.json({
      product: { code: r.code, categoryId: r.category_id, talla: r.talla },
    });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.delete("/api/catalog/products/:code", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const code = String(req.params?.code || "").trim();
    if (!code) return res.status(400).json({ error: "invalid_code" });

    await client.query("BEGIN");
    const pvRes = await client.query(
      `SELECT id FROM product_variants WHERE code = $1 AND active = TRUE LIMIT 1`,
      [code],
    );
    const productVariantId = pvRes.rows[0]?.id || null;
    if (!productVariantId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }

    const stockRes = await client.query(
      `
        SELECT 1 AS ok
        FROM inventory_counts
        WHERE product_variant_id = $1 AND qty > 0
        LIMIT 1
      `,
      [productVariantId],
    );
    if (stockRes.rows?.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "has_stock" });
    }

    await client.query(
      `UPDATE product_variants SET active = FALSE WHERE id = $1`,
      [productVariantId],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/sales", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    const limitRaw = Number(req.query?.limit ?? 50);
    const limit = Math.min(
      200,
      Math.max(1, Math.floor(Number.isFinite(limitRaw) ? limitRaw : 50)),
    );

    const { rows } = await client.query(
      `
        SELECT
          s.id,
          s.receipt_number,
          s.subtotal_cents,
          s.total_cents,
          s.payment_method,
          s.canceled_at,
          s.created_at,
          COALESCE(SUM(si.qty), 0) AS items_count
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.branch_id = $1
        GROUP BY
          s.id,
          s.receipt_number,
          s.subtotal_cents,
          s.total_cents,
          s.payment_method,
          s.canceled_at,
          s.created_at
        ORDER BY s.created_at DESC
        LIMIT $2
      `,
      [branchId, limit],
    );

    res.json({
      sales: rows.map((r) => ({
        id: String(r.id || "").trim(),
        receiptNumber: String(r.receipt_number || "").trim(),
        subtotal: fromCents(r.subtotal_cents),
        total: fromCents(r.total_cents),
        paymentMethod: String(r.payment_method || "").trim(),
        canceledAt: r.canceled_at || null,
        createdAt: r.created_at,
        itemsCount: Number(r.items_count ?? 0),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/sales/:id", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    const saleRes = await client.query(
      `
        SELECT
          id,
          receipt_number,
          subtotal_cents,
          total_cents,
          payment_method,
          canceled_at,
          canceled_reason,
          created_at
        FROM sales
        WHERE id = $1
          AND branch_id = $2
        LIMIT 1
      `,
      [id, branchId],
    );
    const sale = saleRes.rows?.[0] || null;
    if (!sale) return res.status(404).json({ error: "not_found" });

    const itemsRes = await client.query(
      `
        SELECT
          pv.code AS code,
          c.name AS category_name,
          pv.talla AS talla,
          si.qty,
          si.unit_price_cents,
          si.line_total_cents
        FROM sale_items si
        JOIN product_variants pv ON pv.id = si.product_variant_id
        JOIN categories c ON c.id = si.category_id
        WHERE si.sale_id = $1
        ORDER BY c.name ASC, pv.talla ASC, pv.code ASC
      `,
      [id],
    );

    res.json({
      sale: {
        id: String(sale.id || "").trim(),
        receiptNumber: String(sale.receipt_number || "").trim(),
        subtotal: fromCents(sale.subtotal_cents),
        total: fromCents(sale.total_cents),
        paymentMethod: String(sale.payment_method || "").trim(),
        canceledAt: sale.canceled_at || null,
        canceledReason: String(sale.canceled_reason || "").trim(),
        createdAt: sale.created_at,
      },
      items: itemsRes.rows.map((r) => ({
        code: String(r.code || "").trim(),
        categoryName: String(r.category_name || "").trim(),
        talla: String(r.talla || "").trim(),
        qty: Number(r.qty ?? 0),
        unitPrice: fromCents(r.unit_price_cents),
        lineTotal: fromCents(r.line_total_cents),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/sales/:id/cancel", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    const canceledReason = String(req.body?.reason || "").trim() || null;

    await client.query("BEGIN");
    const saleRes = await client.query(
      `
        SELECT id, canceled_at
        FROM sales
        WHERE id = $1
          AND branch_id = $2
        FOR UPDATE
      `,
      [id, branchId],
    );
    const sale = saleRes.rows?.[0] || null;
    if (!sale) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }
    if (sale.canceled_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "already_canceled" });
    }

    const itemsRes = await client.query(
      `
        SELECT product_variant_id, qty
        FROM sale_items
        WHERE sale_id = $1
      `,
      [id],
    );
    const items = Array.isArray(itemsRes.rows) ? itemsRes.rows : [];
    const variantIds = items
      .map((r) => String(r.product_variant_id || "").trim())
      .filter(Boolean);

    if (variantIds.length) {
      const ensureArgs = [branchId, ...variantIds];
      const ensureValues = variantIds
        .map((_, i) => `($1, $${i + 2}, 0)`)
        .join(", ");
      await client.query(
        `
          INSERT INTO inventory_counts (branch_id, product_variant_id, qty)
          VALUES ${ensureValues}
          ON CONFLICT (branch_id, product_variant_id) DO NOTHING
        `,
        ensureArgs,
      );

      await client.query(
        `
          SELECT product_variant_id, qty
          FROM inventory_counts
          WHERE branch_id = $1
            AND product_variant_id = ANY($2::uuid[])
          FOR UPDATE
        `,
        [branchId, variantIds],
      );

      for (const it of items) {
        const productVariantId = String(it.product_variant_id || "").trim();
        const qty = Math.floor(Number(it.qty ?? 0));
        if (!productVariantId || !Number.isFinite(qty) || qty <= 0) continue;

        await client.query(
          `
            UPDATE inventory_counts
            SET qty = qty + $3,
                updated_at = now()
            WHERE branch_id = $1 AND product_variant_id = $2
          `,
          [branchId, productVariantId, qty],
        );

        await client.query(
          `
            INSERT INTO stock_movements (branch_id, product_variant_id, delta, reason, ref)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [branchId, productVariantId, qty, "sale_cancel", id],
        );
      }
    }

    await client.query(
      `
        UPDATE sales
        SET canceled_at = now(),
            canceled_reason = $3
        WHERE id = $1 AND branch_id = $2
      `,
      [id, branchId, canceledReason],
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/sales", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");

    const paymentMethod = String(req.body?.paymentMethod || "").trim();
    const terminalId = String(req.body?.terminalId || "").trim() || null;
    const discountPercentRaw = Number(req.body?.discountPercent ?? 0);
    const discountPercent = Number.isFinite(discountPercentRaw)
      ? Math.min(100, Math.max(0, discountPercentRaw))
      : 0;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!paymentMethod)
      return res.status(400).json({ error: "invalid_payload" });
    if (!items.length) return res.status(400).json({ error: "empty_ticket" });

    const normalizedItems = [];
    for (const it of items) {
      const code = String(it?.code || "").trim();
      const qty = Math.floor(Number(it?.qty ?? 0));
      const unitPrice = Number(it?.unitPrice ?? 0);
      if (!code) return res.status(400).json({ error: "invalid_payload" });
      if (!Number.isFinite(qty) || qty <= 0)
        return res.status(400).json({ error: "invalid_payload" });
      if (!Number.isFinite(unitPrice) || unitPrice < 0)
        return res.status(400).json({ error: "invalid_payload" });
      normalizedItems.push({ code, qty, unitPrice });
    }

    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    const codes = Array.from(new Set(normalizedItems.map((i) => i.code)));
    const variantsRes = await client.query(
      `
        SELECT id, code, category_id
        FROM product_variants
        WHERE active = TRUE
          AND code = ANY($1::text[])
      `,
      [codes],
    );

    const byCode = new Map();
    for (const r of variantsRes.rows)
      byCode.set(String(r.code || "").trim(), {
        id: r.id,
        categoryId: String(r.category_id || "").trim(),
      });

    const missing = codes.filter((c) => !byCode.has(c));
    if (missing.length)
      return res
        .status(404)
        .json({ error: "product_not_found", codes: missing });

    await client.query("BEGIN");

    const variantIds = codes.map((c) => byCode.get(c).id);
    const ensureArgs = [branchId, ...variantIds];
    const ensureValues = variantIds
      .map((_, i) => `($1, $${i + 2}, 0)`)
      .join(", ");
    await client.query(
      `
        INSERT INTO inventory_counts (branch_id, product_variant_id, qty)
        VALUES ${ensureValues}
        ON CONFLICT (branch_id, product_variant_id) DO NOTHING
      `,
      ensureArgs,
    );

    const stockRes = await client.query(
      `
        SELECT product_variant_id, qty
        FROM inventory_counts
        WHERE branch_id = $1
          AND product_variant_id = ANY($2::uuid[])
        FOR UPDATE
      `,
      [branchId, variantIds],
    );
    const stockByVariantId = new Map();
    for (const r of stockRes.rows)
      stockByVariantId.set(String(r.product_variant_id), Number(r.qty ?? 0));

    const insufficient = [];
    for (const it of normalizedItems) {
      const pvId = byCode.get(it.code).id;
      const available = stockByVariantId.get(String(pvId)) ?? 0;
      if (available < it.qty)
        insufficient.push({ code: it.code, available, requested: it.qty });
    }
    if (insufficient.length) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "insufficient_stock", items: insufficient });
    }

    let subtotalCents = 0;
    const itemRows = normalizedItems.map((it) => {
      const unitPriceCents = toCents(it.unitPrice);
      const lineTotalCents = unitPriceCents * it.qty;
      subtotalCents += lineTotalCents;
      const pv = byCode.get(it.code);
      return {
        code: it.code,
        productVariantId: pv.id,
        categoryId: pv.categoryId,
        unitPriceCents,
        qty: it.qty,
        lineTotalCents,
      };
    });

    const totalCents = Math.max(
      0,
      Math.round((subtotalCents * (100 - discountPercent)) / 100),
    );

    const receiptRes = await client.query(
      `
        SELECT
          (
            COALESCE(
              MAX(CASE WHEN receipt_number ~ '^[0-9]+$' THEN receipt_number::BIGINT END),
              0
            ) + 1
          ) AS next
        FROM sales
        WHERE branch_id = $1
      `,
      [branchId],
    );
    const receiptNumber = String(receiptRes.rows?.[0]?.next ?? "").trim();

    const saleRes = await client.query(
      `
        INSERT INTO sales (branch_id, terminal_id, receipt_number, subtotal_cents, total_cents, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, receipt_number, subtotal_cents, total_cents, payment_method, created_at
      `,
      [
        branchId,
        terminalId,
        receiptNumber,
        subtotalCents,
        totalCents,
        paymentMethod,
      ],
    );
    const sale = saleRes.rows?.[0] || null;
    if (!sale) throw new Error("sale_insert_failed");

    for (const it of itemRows) {
      await client.query(
        `
          INSERT INTO sale_items (sale_id, product_variant_id, category_id, unit_price_cents, qty, line_total_cents)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          sale.id,
          it.productVariantId,
          it.categoryId,
          it.unitPriceCents,
          it.qty,
          it.lineTotalCents,
        ],
      );

      await client.query(
        `
          UPDATE inventory_counts
          SET qty = qty - $3,
              updated_at = now()
          WHERE branch_id = $1 AND product_variant_id = $2
        `,
        [branchId, it.productVariantId, it.qty],
      );

      await client.query(
        `
          INSERT INTO stock_movements (branch_id, product_variant_id, delta, reason, ref)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [branchId, it.productVariantId, -it.qty, "sale", String(sale.id)],
      );
    }

    await client.query("COMMIT");
    res.json({
      sale: {
        id: String(sale.id || "").trim(),
        receiptNumber: String(sale.receipt_number || "").trim(),
        subtotal: fromCents(sale.subtotal_cents),
        total: fromCents(sale.total_cents),
        paymentMethod: String(sale.payment_method || "").trim(),
        createdAt: sale.created_at,
      },
    });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/inventory/movements", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    const limitRaw = Number(req.query?.limit ?? 50);
    const limit = Math.min(
      200,
      Math.max(1, Math.floor(Number.isFinite(limitRaw) ? limitRaw : 50)),
    );
    const pageRaw = Number(req.query?.page ?? 1);
    const page = Math.max(
      1,
      Math.floor(Number.isFinite(pageRaw) ? pageRaw : 1),
    );
    const offset = (page - 1) * limit;

    const categoryId = String(req.query?.categoryId || "").trim() || null;

    const args = [branchId];
    let where = `sm.branch_id = $1`;
    if (categoryId) {
      args.push(categoryId);
      where += ` AND c.id = $${args.length}`;
    }
    args.push(limit + 1);
    args.push(offset);

    const r = await client.query(
      `
        SELECT
          sm.id,
          sm.created_at,
          sm.reason,
          sm.delta,
          sm.ref,
          pv.code AS code,
          pv.talla AS talla,
          c.id AS category_id,
          c.name AS category_name
        FROM stock_movements sm
        JOIN product_variants pv ON pv.id = sm.product_variant_id
        JOIN categories c ON c.id = pv.category_id
        WHERE ${where}
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT $${args.length - 1}
        OFFSET $${args.length}
      `,
      args,
    );

    const rows = Array.isArray(r?.rows) ? r.rows : [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      page,
      limit,
      hasMore,
      movements: pageRows.map((row) => ({
        id: String(row.id || "").trim(),
        createdAt: row.created_at,
        reason: String(row.reason || "").trim(),
        delta: Number(row.delta ?? 0),
        ref: String(row.ref || "").trim(),
        code: String(row.code || "").trim(),
        talla: String(row.talla || "").trim(),
        categoryId: String(row.category_id || "").trim(),
        categoryName: String(row.category_name || "").trim(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/inventory/stock", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    const { rows } = await client.query(
      `
        SELECT pv.code AS code, ic.qty
        FROM product_variants pv
        LEFT JOIN inventory_counts ic
          ON ic.product_variant_id = pv.id
         AND ic.branch_id = $1
        WHERE pv.active = TRUE
      `,
      [branchId],
    );

    const stockByProductCode = {};
    for (const r of rows)
      stockByProductCode[String(r.code)] = Number(r.qty ?? 0);
    res.json({ stockByProductCode });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/inventory/adjust", async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!client) throw new Error("DATABASE_URL is not set");
    const code = String(req.body?.code || "").trim();
    const delta = Number(req.body?.delta || 0);
    const reason =
      String(req.body?.reason || "manual_adjust").trim() || "manual_adjust";
    if (!code || !Number.isFinite(delta) || delta === 0)
      return res.status(400).json({ error: "invalid_payload" });

    const branchId = await getBranchIdForRequest(client, req);
    if (!branchId) throw new Error("branch_not_found");

    await client.query("BEGIN");
    const pv = await client.query(
      `SELECT id FROM product_variants WHERE code = $1 AND active = TRUE`,
      [code],
    );
    const productVariantId = pv.rows[0]?.id;
    if (!productVariantId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "product_not_found" });
    }

    await client.query(
      `
        INSERT INTO inventory_counts (branch_id, product_variant_id, qty)
        VALUES ($1, $2, 0)
        ON CONFLICT (branch_id, product_variant_id) DO NOTHING
      `,
      [branchId, productVariantId],
    );

    const updated = await client.query(
      `
        UPDATE inventory_counts
        SET qty = GREATEST(0, qty + $3),
            updated_at = now()
        WHERE branch_id = $1 AND product_variant_id = $2
        RETURNING qty
      `,
      [branchId, productVariantId, delta],
    );

    await client.query(
      `
        INSERT INTO stock_movements (branch_id, product_variant_id, delta, reason)
        VALUES ($1, $2, $3, $4)
      `,
      [branchId, productVariantId, delta, reason],
    );

    await client.query("COMMIT");
    res.json({ ok: true, code, qty: Number(updated.rows[0]?.qty ?? 0) });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rollbackError) {
      void rollbackError;
    }
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    if (client) client.release();
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  process.stdout.write(`server listening on http://localhost:${port}\n`);
});
