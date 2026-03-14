import { useEffect, useMemo, useRef, useState } from "react";
import BigButton from "../components/BigButton.jsx";
import Field from "../components/Field.jsx";
import SelectField from "../components/SelectField.jsx";
import { apiGet, apiSend } from "../api.js";
import logoPng from "../assets/logo.png?inline";
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 5;
const GRID_COLS = 2;
const GRID_ROWS = 3;
const GRID_GAP_MM = 5;
const SHEET_PAGE_SIZE = GRID_COLS * GRID_ROWS;
const FIXED_FONT_FAMILY_SVG = "acumin-pro";
const FIXED_FONT_WEIGHT = 700;
const SHEET_STORAGE_KEY = "myrboutique:separadores:sheet:v1";

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function toNumberLoose(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  const x = Number(s);
  return x;
}

function clampNumber(n, min, max) {
  const x = toNumberLoose(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readJson(key) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function getGridGeometry() {
  const contentW = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentH = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
  const cellW = (contentW - GRID_GAP_MM * (GRID_COLS - 1)) / GRID_COLS;
  const cellH = (contentH - GRID_GAP_MM * (GRID_ROWS - 1)) / GRID_ROWS;
  return {
    contentW,
    contentH,
    cellW,
    cellH,
  };
}

function getCellCenter(col, row) {
  const g = getGridGeometry();
  const x = PAGE_MARGIN_MM + col * (g.cellW + GRID_GAP_MM) + g.cellW / 2;
  const y = PAGE_MARGIN_MM + row * (g.cellH + GRID_GAP_MM) + g.cellH / 2;
  return { x: round3(x), y: round3(y) };
}

function parseQty(raw) {
  const s = String(raw || "").trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function chunkPages(list, pageSize) {
  const pages = [];
  for (let i = 0; i < list.length; i += pageSize) {
    pages.push(list.slice(i, i + pageSize));
  }
  return pages.length ? pages : [[]];
}

function LabelCutAndContent({
  part,
  cx,
  cy,
  index,
  outerDiameterMm,
  innerDiameterMm,
  slitWidthMm,
  logoUrl,
  size,
  sizeLines,
  fontFamily,
  fontWeight,
  fontSizeMm,
  lineGapMm,
  yOffsetMm,
  sideOffsetMm,
  letterSpacingMm,
  showGuides,
  variablesMode,
}) {
  const outerD = clampNumber(outerDiameterMm, 10, 200);
  const innerD = clampNumber(innerDiameterMm, 5, outerD - 2);
  const outerR = outerD / 2;
  const innerR = innerD / 2;
  const slitW = clampNumber(slitWidthMm, 0.5, 15);

  const slitDx = slitW / 2;
  const slitX1 = round3(cx - slitDx);
  const slitX2 = round3(cx + slitDx);
  const slitOuterDy = Math.sqrt(Math.max(0, outerR * outerR - slitDx * slitDx));
  const slitInnerDy = Math.sqrt(Math.max(0, innerR * innerR - slitDx * slitDx));
  const slitYOuter = round3(cy + slitOuterDy);
  const slitYInner = round3(cy + slitInnerDy);

  const thickness = outerR - innerR;
  const baseSideOffset = innerR + thickness * 0.58;
  const sideOffset = round3(
    baseSideOffset + clampNumber(sideOffsetMm ?? 0, -15, 15),
  );
  const logoY = cy - (innerR + thickness * 0.45);
  const sideY = round3(cy + clampNumber(yOffsetMm ?? 0, -20, 20));

  const sizeFont = clampNumber(fontSizeMm ?? thickness * 0.9, 1, 999);
  const sizeLineGap = clampNumber(lineGapMm ?? 5, 2, 20);
  const sizeLetterSpacing = clampNumber(letterSpacingMm ?? 0, -2, 6);
  const effectiveFontFamily = String(fontFamily || "").trim() || null;
  const effectiveFontWeight = clampNumber(fontWeight ?? 900, 100, 1000);

  const logoW = 42;
  const logoH = 20;
  const logoFont = clampNumber(7, 4, 9);

  const rawSizeText = String(size || "").trim();
  const rawLines = Array.isArray(sizeLines)
    ? sizeLines.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const linesFromText = rawSizeText ? [rawSizeText] : [];
  const baseLines = rawLines.length ? rawLines : linesFromText;
  const lines =
    variablesMode && baseLines.length
      ? baseLines.length === 1
        ? [`SIZE_${index}`]
        : baseLines.map((_, i) => `SIZE_${index}_${i + 1}`)
      : baseLines;

  const sizeText = variablesMode ? "SIZE" : rawSizeText;
  const effectiveLogoUrl = variablesMode ? "" : String(logoUrl || "").trim();

  if (part === "cut") {
    const outerPath = `M ${slitX2} ${slitYOuter} A ${outerR} ${outerR} 0 1 0 ${slitX1} ${slitYOuter}`;
    const innerPath = `M ${slitX2} ${slitYInner} A ${innerR} ${innerR} 0 1 0 ${slitX1} ${slitYInner}`;
    return (
      <g>
        <path d={outerPath} />
        <path d={innerPath} />
        <line x1={slitX1} y1={slitYInner} x2={slitX1} y2={slitYOuter} />
        <line x1={slitX2} y1={slitYInner} x2={slitX2} y2={slitYOuter} />
      </g>
    );
  }

  if (part === "content") {
    const normalizeToken = (t) => {
      const v = String(t || "").trim();
      if (!v) return "";
      if (v === "-" || v === "–" || v === "—" || v === "−") return "−";
      return v;
    };

    const renderSide = (side, x) => {
      const rawSafeLines = lines.length ? lines : [sizeText || "—"];
      let safeLines = rawSafeLines.map(normalizeToken).filter(Boolean);
      const looksNumeric = (s) => /^\d/.test(String(s || "").trim());
      if (
        safeLines.length === 2 &&
        looksNumeric(safeLines[0]) &&
        looksNumeric(safeLines[1])
      ) {
        safeLines = [safeLines[0], "−", safeLines[1]];
      }
      if (!safeLines.length) safeLines = ["—"];
      const startY = round3(sideY - ((safeLines.length - 1) / 2) * sizeLineGap);
      return safeLines.map((t, i) => (
        <text
          key={`${side}-${i}`}
          id={`SIZE_${side}_${index}_${i + 1}`}
          x={x}
          y={round3(startY + i * sizeLineGap)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={sizeFont}
          fontWeight={effectiveFontWeight}
          fontFamily={effectiveFontFamily || undefined}
          letterSpacing={sizeLetterSpacing || undefined}
        >
          {String(t || "").trim() || "—"}
        </text>
      ));
    };

    return (
      <g>
        {effectiveLogoUrl ? (
          <image
            href={effectiveLogoUrl}
            x={round3(cx - logoW / 2)}
            y={round3(logoY - logoH / 2)}
            width={logoW}
            height={logoH}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <text
            id={`LOGO_${index}`}
            x={cx}
            y={logoY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={logoFont}
            fontWeight="800"
          >
            LOGO
          </text>
        )}

        {renderSide("L", round3(cx - sideOffset))}
        {renderSide("R", round3(cx + sideOffset))}
      </g>
    );
  }

  if (part === "guides" && showGuides) {
    return (
      <g
        className="GUIDES"
        stroke="#9CA3AF"
        strokeWidth={0.2}
        fill="none"
        opacity={0.35}
        vectorEffect="non-scaling-stroke"
      >
        <circle cx={cx} cy={cy} r={outerR} strokeDasharray="2 2" />
        <rect
          x={round3(cx - logoW / 2)}
          y={round3(logoY - logoH / 2)}
          width={logoW}
          height={logoH}
          strokeDasharray="2 2"
        />
        <line
          x1={cx}
          y1={round3(cy - outerR)}
          x2={cx}
          y2={round3(cy + outerR)}
        />
        <line
          x1={round3(cx - outerR)}
          y1={cy}
          x2={round3(cx + outerR)}
          y2={cy}
        />
      </g>
    );
  }

  return null;
}

function A4TemplateSvg({
  svgRef,
  outerDiameterMm,
  innerDiameterMm,
  slitWidthMm,
  logoUrl,
  labels,
  showGuides,
  variablesMode,
}) {
  const g = getGridGeometry();
  const pageBorder = {
    x: 0,
    y: 0,
    w: A4_WIDTH_MM,
    h: A4_HEIGHT_MM,
  };
  const safeBorder = {
    x: PAGE_MARGIN_MM,
    y: PAGE_MARGIN_MM,
    w: A4_WIDTH_MM - PAGE_MARGIN_MM * 2,
    h: A4_HEIGHT_MM - PAGE_MARGIN_MM * 2,
  };

  return (
    <svg
      ref={svgRef}
      width={`${A4_WIDTH_MM}mm`}
      height={`${A4_HEIGHT_MM}mm`}
      viewBox={`0 0 ${A4_WIDTH_MM} ${A4_HEIGHT_MM}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        @media print {
          .GUIDES, #PAGE_GUIDES { display: none; }
        }
      `}</style>

      {showGuides ? (
        <g
          id="PAGE_GUIDES"
          stroke="#9CA3AF"
          strokeWidth={0.2}
          fill="none"
          opacity={0.25}
          vectorEffect="non-scaling-stroke"
        >
          <rect
            x={pageBorder.x}
            y={pageBorder.y}
            width={pageBorder.w}
            height={pageBorder.h}
          />
          <rect
            x={safeBorder.x}
            y={safeBorder.y}
            width={safeBorder.w}
            height={safeBorder.h}
            strokeDasharray="2 2"
          />
          {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
            const col = idx % GRID_COLS;
            const row = Math.floor(idx / GRID_COLS);
            const x = round3(PAGE_MARGIN_MM + col * (g.cellW + GRID_GAP_MM));
            const y = round3(PAGE_MARGIN_MM + row * (g.cellH + GRID_GAP_MM));
            return (
              <rect
                key={`cell-${idx}`}
                x={x}
                y={y}
                width={round3(g.cellW)}
                height={round3(g.cellH)}
                strokeDasharray="2 2"
              />
            );
          })}
        </g>
      ) : null}

      <g
        id="CUT_LINE"
        stroke="black"
        strokeWidth="0.3pt"
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
          const col = idx % GRID_COLS;
          const row = Math.floor(idx / GRID_COLS);
          const c = getCellCenter(col, row);
          const l = labels[idx] || null;
          return (
            <LabelCutAndContent
              key={`cut-${l?.id || idx}`}
              part="cut"
              cx={c.x}
              cy={c.y}
              index={idx + 1}
              outerDiameterMm={outerDiameterMm}
              innerDiameterMm={innerDiameterMm}
              slitWidthMm={slitWidthMm}
              logoUrl={logoUrl}
              size={l?.size}
              sizeLines={l?.lines}
              fontFamily={l?.fontFamily}
              fontWeight={l?.fontWeight}
              fontSizeMm={l?.fontSizeMm}
              lineGapMm={l?.lineGapMm}
              yOffsetMm={l?.yOffsetMm}
              sideOffsetMm={l?.sideOffsetMm}
              letterSpacingMm={l?.letterSpacingMm}
              showGuides={showGuides}
              variablesMode={variablesMode}
            />
          );
        })}
      </g>

      <g
        fill="black"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
      >
        {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
          const col = idx % GRID_COLS;
          const row = Math.floor(idx / GRID_COLS);
          const c = getCellCenter(col, row);
          const l = labels[idx] || null;
          return (
            <LabelCutAndContent
              key={`content-${l?.id || idx}`}
              part="content"
              cx={c.x}
              cy={c.y}
              index={idx + 1}
              outerDiameterMm={outerDiameterMm}
              innerDiameterMm={innerDiameterMm}
              slitWidthMm={slitWidthMm}
              logoUrl={logoUrl}
              size={l?.size}
              sizeLines={l?.lines}
              fontFamily={l?.fontFamily}
              fontWeight={l?.fontWeight}
              fontSizeMm={l?.fontSizeMm}
              lineGapMm={l?.lineGapMm}
              yOffsetMm={l?.yOffsetMm}
              sideOffsetMm={l?.sideOffsetMm}
              letterSpacingMm={l?.letterSpacingMm}
              showGuides={showGuides}
              variablesMode={variablesMode}
            />
          );
        })}
      </g>

      {showGuides
        ? Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
            const col = idx % GRID_COLS;
            const row = Math.floor(idx / GRID_COLS);
            const c = getCellCenter(col, row);
            const l = labels[idx] || null;
            return (
              <LabelCutAndContent
                key={`guides-${l?.id || idx}`}
                part="guides"
                cx={c.x}
                cy={c.y}
                index={idx + 1}
                outerDiameterMm={outerDiameterMm}
                innerDiameterMm={innerDiameterMm}
                slitWidthMm={slitWidthMm}
                logoUrl={logoUrl}
                size={l?.size}
                sizeLines={l?.lines}
                fontFamily={l?.fontFamily}
                fontWeight={l?.fontWeight}
                fontSizeMm={l?.fontSizeMm}
                lineGapMm={l?.lineGapMm}
                yOffsetMm={l?.yOffsetMm}
                sideOffsetMm={l?.sideOffsetMm}
                letterSpacingMm={l?.letterSpacingMm}
                showGuides={showGuides}
                variablesMode={variablesMode}
              />
            );
          })
        : null}
    </svg>
  );
}

export default function SeparadoresPage() {
  const svgRefsValues = useRef([]);
  const svgRefsVariables = useRef([]);

  const [sizes, setSizes] = useState([]);
  const [sizesStatus, setSizesStatus] = useState("idle");
  const [sizesError, setSizesError] = useState("");

  const [showSizesPanel, setShowSizesPanel] = useState(false);
  const [editSizeId, setEditSizeId] = useState("");
  const [sizeName, setSizeName] = useState("");
  const [sizeLinesText, setSizeLinesText] = useState("");
  const [sizeFontSizeMm, setSizeFontSizeMm] = useState("12");
  const [sizeLineGapMm, setSizeLineGapMm] = useState("5");
  const [sizeYOffsetMm, setSizeYOffsetMm] = useState("0");
  const [sizeSideOffsetMm, setSizeSideOffsetMm] = useState("0");
  const [sizeLetterSpacingMm, setSizeLetterSpacingMm] = useState("0");

  const [outerDiameterMm, setOuterDiameterMm] = useState("84");
  const [innerDiameterMm, setInnerDiameterMm] = useState("41");
  const [slitWidthMm, setSlitWidthMm] = useState("5");

  const [showGuides, setShowGuides] = useState(true);
  const [showParams, setShowParams] = useState(false);

  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [qtyDraft, setQtyDraft] = useState("1");
  const [sheet, setSheet] = useState(() => {
    const saved = readJson(SHEET_STORAGE_KEY);
    const next = Array.isArray(saved)
      ? saved
          .map((it) => ({
            id: String(it?.id || "").trim(),
            sizeId: String(it?.sizeId || "").trim(),
          }))
          .filter((it) => it.id && it.sizeId)
      : [];
    return next;
  });

  const sizesById = useMemo(() => {
    const m = {};
    for (const s of sizes) m[String(s.id)] = s;
    return m;
  }, [sizes]);

  const outerD = useMemo(
    () => clampNumber(outerDiameterMm, 10, 200),
    [outerDiameterMm],
  );
  const innerD = useMemo(
    () => clampNumber(innerDiameterMm, 5, outerD - 2),
    [innerDiameterMm, outerD],
  );
  const slitW = useMemo(() => clampNumber(slitWidthMm, 0.5, 15), [slitWidthMm]);

  function printSheet() {
    window.print();
  }

  function downloadSvg(mode) {
    const nodes =
      mode === "variables" ? svgRefsVariables.current : svgRefsValues.current;
    const present = nodes.filter(Boolean);
    if (!present.length) return;

    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    for (let i = 0; i < present.length; i += 1) {
      const svgNode = present[i];
      const clone = svgNode.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const xml = new XMLSerializer().serializeToString(clone);

      const base =
        mode === "variables"
          ? "plantilla-separadores-A4-variables"
          : "plantilla-separadores-A4";
      const suffix = present.length > 1 ? `-p${i + 1}` : "";
      downloadTextFile(
        `${base}${suffix}.svg`,
        header + xml,
        "image/svg+xml;charset=utf-8",
      );
    }
  }

  const sheetPages = useMemo(() => chunkPages(sheet, SHEET_PAGE_SIZE), [sheet]);

  const sheetCountBySizeId = useMemo(() => {
    const out = {};
    for (const it of sheet) {
      const id = String(it?.sizeId || "").trim();
      if (!id) continue;
      out[id] = (out[id] || 0) + 1;
    }
    return out;
  }, [sheet]);

  const sheetCounts = useMemo(() => {
    const rows = Object.keys(sheetCountBySizeId).map((sizeId) => {
      const s = sizesById[String(sizeId)] || null;
      return {
        sizeId,
        name: String(s?.name || "").trim() || sizeId,
        count: Number(sheetCountBySizeId[sizeId] || 0),
      };
    });
    rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return rows;
  }, [sheetCountBySizeId, sizesById]);

  const estimatedPages = useMemo(() => {
    const count = sheet.length;
    if (!count) return 1;
    return Math.ceil(count / SHEET_PAGE_SIZE);
  }, [sheet.length]);

  const draftLines = useMemo(() => {
    const name = String(sizeName || "").trim();
    const raw = String(sizeLinesText || "");
    const lines = raw
      .split("\n")
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    const normalizeToken = (t) => {
      const v = String(t || "").trim();
      if (!v) return "";
      if (v === "-" || v === "–" || v === "—" || v === "−") return "−";
      return v;
    };
    const looksNumeric = (s) => /^\d/.test(String(s || "").trim());

    if (
      lines.length === 2 &&
      looksNumeric(lines[0]) &&
      looksNumeric(lines[1])
    ) {
      return [normalizeToken(lines[0]), "−", normalizeToken(lines[1])].filter(
        Boolean,
      );
    }

    if (lines.length === 1) {
      const s = lines[0];
      const m = String(s || "").match(/^\s*(.+?)\s*[-–—−]\s*(.+?)\s*$/);
      if (m && looksNumeric(m[1]) && looksNumeric(m[2])) {
        return [normalizeToken(m[1]), "−", normalizeToken(m[2])].filter(
          Boolean,
        );
      }
    }

    if (lines.length) return lines.map(normalizeToken).filter(Boolean);
    if (name) return [name];
    return [];
  }, [sizeLinesText, sizeName]);

  async function loadSizes() {
    setSizesError("");
    setSizesStatus("loading");
    try {
      const r = await apiGet("/api/separator-sizes");
      const next = Array.isArray(r?.sizes) ? r.sizes : [];
      setSizes(next);
      const currentSelected = String(selectedSizeId || "").trim();
      const hasSelected = currentSelected
        ? next.some((s) => String(s.id) === currentSelected)
        : false;
      if (!hasSelected) {
        setSelectedSizeId(next.length ? String(next[0].id) : "");
      }
      setSizesStatus("ready");
    } catch (e) {
      setSizesStatus("error");
      const msg = String(e?.message || e);
      if (Number(e?.status) === 404 || msg === "Not Found") {
        setSizesError(
          "No existe /api/separator-sizes (Not Found). Reinicia el backend y corre la migración.",
        );
      } else {
        setSizesError(msg);
      }
    }
  }

  function resetSizeForm(nextSelectedId) {
    setEditSizeId("");
    setSizeName("");
    setSizeLinesText("");
    setSizeFontSizeMm("12");
    setSizeLineGapMm("5");
    setSizeYOffsetMm("0");
    setSizeSideOffsetMm("0");
    setSizeLetterSpacingMm("0");
    if (nextSelectedId !== undefined) setSelectedSizeId(nextSelectedId);
  }

  function startEditSize(id) {
    const s = sizesById[String(id || "")];
    if (!s) return;
    setShowSizesPanel(true);
    setEditSizeId(String(s.id));
    setSizeName(String(s.name || ""));
    const lines = Array.isArray(s.lines) ? s.lines : [];
    const normalizeToken = (t) => {
      const v = String(t || "").trim();
      if (!v) return "";
      if (v === "-" || v === "–" || v === "—" || v === "−") return "−";
      return v;
    };
    const normalized = lines.map(normalizeToken).filter(Boolean);
    if (normalized.length === 3 && normalized[1] === "−") {
      setSizeLinesText([normalized[0], normalized[2]].join("\n"));
    } else {
      setSizeLinesText(
        normalized.length ? normalized.join("\n") : String(s.name || ""),
      );
    }
    setSizeFontSizeMm(String(s.fontSizeMm ?? 12));
    setSizeLineGapMm(String(s.lineGapMm ?? 5));
    setSizeYOffsetMm(String(s.yOffsetMm ?? 0));
    setSizeSideOffsetMm(String(s.sideOffsetMm ?? 0));
    setSizeLetterSpacingMm(String(s.letterSpacingMm ?? 0));
  }

  async function saveSize() {
    const name = String(sizeName || "").trim();
    if (!name) return;

    const payload = {
      name,
      lines: draftLines.length
        ? draftLines.join("\n")
        : String(sizeLinesText || "").trim() || name,
      fontSizeMm: clampNumber(sizeFontSizeMm, 1, 999),
      lineGapMm: clampNumber(sizeLineGapMm, 2, 20),
      yOffsetMm: clampNumber(sizeYOffsetMm, -20, 20),
      sideOffsetMm: clampNumber(sizeSideOffsetMm, -15, 15),
      letterSpacingMm: clampNumber(sizeLetterSpacingMm, -2, 6),
    };

    setSizesError("");
    setSizesStatus("saving");
    try {
      if (editSizeId) {
        await apiSend(`/api/separator-sizes/${editSizeId}`, "PATCH", payload);
      } else {
        const created = await apiSend("/api/separator-sizes", "POST", payload);
        const id = String(created?.size?.id || "").trim();
        if (id) setSelectedSizeId(id);
      }
      await loadSizes();
      resetSizeForm();
      setSizesStatus("ready");
    } catch (e) {
      const status = Number(e?.status || 0);
      const apiError = String(e?.body?.error || "").trim();
      const message = String(e?.message || e);
      if (
        status === 409 ||
        apiError === "duplicate_name" ||
        message === "duplicate_name"
      ) {
        window.alert("Ya existe una talla con este nombre");
        setSizesStatus("error");
        setSizesError("Ya existe una talla con este nombre");
        return;
      }
      setSizesStatus("error");
      setSizesError(message);
    }
  }

  async function deleteSize(id, name) {
    const safeId = String(id || "").trim();
    if (!safeId) return;
    const label = String(name || "").trim() || "esta talla";
    const ok = window.confirm(`¿Seguro que quieres eliminar "${label}"?`);
    if (!ok) return;
    setSizesError("");
    setSizesStatus("saving");
    try {
      await apiSend(`/api/separator-sizes/${safeId}`, "DELETE", {});
      await loadSizes();
      if (editSizeId === safeId) resetSizeForm();
      setSizesStatus("ready");
    } catch (e) {
      setSizesStatus("error");
      setSizesError(String(e?.message || e));
    }
  }

  async function duplicateSize(s) {
    if (!s) return;
    const sourceName = String(s.name || "").trim();
    if (!sourceName) return;

    const normalizeKey = (v) =>
      String(v || "")
        .trim()
        .toLowerCase();
    const existingKeys = new Set(sizes.map((it) => normalizeKey(it?.name)));
    const baseName = sourceName
      .replace(/\s*\(copia(?:\s+\d+)?\)\s*$/i, "")
      .trim();

    let nextName = `${baseName || sourceName} (copia)`;
    if (existingKeys.has(normalizeKey(nextName))) {
      for (let i = 2; i <= 99; i += 1) {
        const candidate = `${baseName || sourceName} (copia ${i})`;
        if (!existingKeys.has(normalizeKey(candidate))) {
          nextName = candidate;
          break;
        }
      }
    }

    const nextLines =
      Array.isArray(s.lines) && s.lines.length ? s.lines : [sourceName];
    const payload = {
      name: nextName,
      lines: nextLines.join("\n"),
      fontSizeMm: Number(s.fontSizeMm ?? 12),
      lineGapMm: Number(s.lineGapMm ?? 5),
      yOffsetMm: Number(s.yOffsetMm ?? 0),
      sideOffsetMm: Number(s.sideOffsetMm ?? 0),
      letterSpacingMm: Number(s.letterSpacingMm ?? 0),
    };

    setSizesError("");
    setSizesStatus("saving");
    try {
      const created = await apiSend("/api/separator-sizes", "POST", payload);
      const id = String(created?.size?.id || "").trim();
      await loadSizes();
      if (id) setSelectedSizeId(id);
      setSizesStatus("ready");
    } catch (e) {
      const status = Number(e?.status || 0);
      const apiError = String(e?.body?.error || "").trim();
      const message = String(e?.message || e);
      if (
        status === 409 ||
        apiError === "duplicate_name" ||
        message === "duplicate_name"
      ) {
        window.alert("Ya existe una talla con este nombre");
        setSizesStatus("error");
        setSizesError("Ya existe una talla con este nombre");
        return;
      }
      setSizesStatus("error");
      setSizesError(message);
    }
  }

  useEffect(() => {
    loadSizes();
  }, []);

  useEffect(() => {
    writeJson(SHEET_STORAGE_KEY, sheet);
  }, [sheet]);

  function addToSheet() {
    const sizeId = String(selectedSizeId || "").trim();
    if (!sizeId) return;
    if (!sizesById[sizeId]) return;
    const qty = parseQty(qtyDraft);
    if (!qty) return;

    setSheet((prev) => {
      const next = [...prev];
      let seq = 0;
      for (let i = 0; i < qty; i += 1) {
        next.push({
          id: `${Date.now()}-${Math.random()}-${seq}`,
          sizeId,
        });
        seq += 1;
      }
      return next;
    });

    setQtyDraft("1");
  }

  function clearSheet() {
    setSheet([]);
  }

  return (
    <div className="space-y-5 print:space-y-0">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <h1 className="text-2xl font-extrabold tracking-tight print:hidden">
        Plantilla de separadores (A4)
      </h1>

      <div className="print:hidden">
        <BigButton
          onClick={() => {
            resetSizeForm();
            setShowSizesPanel(true);
          }}
        >
          Agregar talla
        </BigButton>
      </div>

      {showSizesPanel ? (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6 print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-lg font-extrabold tracking-tight">
                Tallas (BD)
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Aquí defines cómo se acomoda el texto (líneas, tamaño y
                posición).
              </div>
              {sizesError ? (
                <div className="mt-2 text-sm font-extrabold text-rose-600">
                  {sizesError}
                </div>
              ) : null}
            </div>

            <div className="flex gap-3">
              <BigButton
                variant="secondary"
                className="h-10 px-4 text-sm"
                onClick={() => {
                  resetSizeForm();
                  setShowSizesPanel(false);
                }}
              >
                Cerrar
              </BigButton>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Nombre"
                  value={sizeName}
                  onChange={(e) => setSizeName(e.target.value)}
                  placeholder="Ej. 8 - 10"
                  className="sm:col-span-2"
                />
                <Field
                  label="Tamaño letra (mm)"
                  value={sizeFontSizeMm}
                  onChange={(e) => setSizeFontSizeMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="12"
                />
                <Field
                  label="Separación líneas (mm)"
                  value={sizeLineGapMm}
                  onChange={(e) => setSizeLineGapMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="5"
                />

                <label className="block sm:col-span-2">
                  <div className="text-sm font-extrabold text-slate-700">
                    Líneas (1 por línea)
                  </div>
                  <textarea
                    value={sizeLinesText}
                    onChange={(e) => setSizeLinesText(e.target.value)}
                    rows={3}
                    className={[
                      "mt-2 w-full rounded-2xl bg-white px-4 py-3 text-base font-semibold",
                      "ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900",
                    ].join(" ")}
                    placeholder={"Ej:\n8\n-\n10"}
                  />
                </label>

                <Field
                  label="Ajuste vertical (mm)"
                  value={sizeYOffsetMm}
                  onChange={(e) => setSizeYOffsetMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <Field
                  label="Ajuste lateral (mm)"
                  value={sizeSideOffsetMm}
                  onChange={(e) => setSizeSideOffsetMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <Field
                  label="Espaciado letras (mm)"
                  value={sizeLetterSpacingMm}
                  onChange={(e) => setSizeLetterSpacingMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <BigButton
                  className="w-full"
                  onClick={saveSize}
                  disabled={
                    sizesStatus === "saving" || sizesStatus === "loading"
                  }
                >
                  {editSizeId ? "Guardar cambios" : "Crear talla"}
                </BigButton>
                <BigButton
                  className="w-full"
                  variant="secondary"
                  onClick={() => resetSizeForm()}
                >
                  Limpiar
                </BigButton>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-sm font-extrabold text-slate-700">
                Vista previa
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Se renderiza simétrico (izq/der).
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                <svg
                  width="100%"
                  viewBox="0 0 120 120"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    stroke="#111827"
                    strokeWidth="0.3pt"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  >
                    <LabelCutAndContent
                      part="cut"
                      cx={60}
                      cy={60}
                      index={1}
                      outerDiameterMm={outerD}
                      innerDiameterMm={innerD}
                      slitWidthMm={slitW}
                      logoUrl={logoPng}
                      size={String(sizeName || "").trim()}
                      sizeLines={draftLines}
                      fontFamily={FIXED_FONT_FAMILY_SVG}
                      fontWeight={FIXED_FONT_WEIGHT}
                      fontSizeMm={clampNumber(sizeFontSizeMm, 1, 999)}
                      lineGapMm={clampNumber(sizeLineGapMm, 2, 20)}
                      yOffsetMm={clampNumber(sizeYOffsetMm, -20, 20)}
                      sideOffsetMm={clampNumber(sizeSideOffsetMm, -15, 15)}
                      letterSpacingMm={clampNumber(sizeLetterSpacingMm, -2, 6)}
                      showGuides={false}
                      variablesMode={false}
                    />
                  </g>
                  <g
                    fill="#111827"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
                  >
                    <LabelCutAndContent
                      part="content"
                      cx={60}
                      cy={60}
                      index={1}
                      outerDiameterMm={outerD}
                      innerDiameterMm={innerD}
                      slitWidthMm={slitW}
                      logoUrl={logoPng}
                      size={String(sizeName || "").trim()}
                      sizeLines={draftLines}
                      fontFamily={FIXED_FONT_FAMILY_SVG}
                      fontWeight={FIXED_FONT_WEIGHT}
                      fontSizeMm={clampNumber(sizeFontSizeMm, 1, 999)}
                      lineGapMm={clampNumber(sizeLineGapMm, 2, 20)}
                      yOffsetMm={clampNumber(sizeYOffsetMm, -20, 20)}
                      sideOffsetMm={clampNumber(sizeSideOffsetMm, -15, 15)}
                      letterSpacingMm={clampNumber(sizeLetterSpacingMm, -2, 6)}
                      showGuides={false}
                      variablesMode={false}
                    />
                  </g>
                </svg>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-700">
                Guardadas
              </div>
            </div>

            {sizesStatus === "loading" ? (
              <div className="mt-2 text-sm font-semibold text-slate-600">
                Cargando…
              </div>
            ) : null}

            <div className="mt-2 grid grid-cols-1 gap-2">
              {sizes.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-slate-900">
                      {s.name}
                    </div>
                    <div className="truncate text-xs font-semibold text-slate-500">
                      {(Array.isArray(s.lines) && s.lines.length
                        ? s.lines
                        : [s.name]
                      ).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <BigButton
                      variant="secondary"
                      className="h-10 px-4 text-sm"
                      onClick={() => duplicateSize(s)}
                    >
                      Duplicar
                    </BigButton>
                    <BigButton
                      variant="secondary"
                      className="h-10 px-4 text-sm"
                      onClick={() => startEditSize(s.id)}
                    >
                      Editar
                    </BigButton>
                    <BigButton
                      variant="danger"
                      className="h-10 px-4 text-sm"
                      onClick={() => deleteSize(s.id, s.name)}
                    >
                      Eliminar
                    </BigButton>
                  </div>
                </div>
              ))}
              {!sizes.length ? (
                <div className="text-sm font-semibold text-slate-600">
                  No hay tallas guardadas todavía.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6 print:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold tracking-tight">Hoja</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Agrega tallas a la hoja (6 por página).
              </div>
            </div>
            <BigButton
              variant="secondary"
              className="h-10 px-4 text-sm"
              onClick={() => setShowParams((v) => !v)}
            >
              Parámetros
            </BigButton>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {showParams ? (
              <>
                <div className="sm:col-span-2 text-sm font-semibold text-slate-600">
                  Hoja A4 (210×297mm), margen 5mm, 2×3, separación 5mm.
                </div>
                <Field
                  label="Diámetro exterior (mm)"
                  value={outerDiameterMm}
                  onChange={(e) => setOuterDiameterMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="90"
                />
                <Field
                  label="Diámetro interior (mm)"
                  value={innerDiameterMm}
                  onChange={(e) => setInnerDiameterMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="35"
                />
                <Field
                  label="Apertura (mm)"
                  value={slitWidthMm}
                  onChange={(e) => setSlitWidthMm(e.target.value)}
                  inputMode="decimal"
                  placeholder="5"
                />

                <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={showGuides}
                    onChange={(e) => setShowGuides(e.target.checked)}
                  />
                  Mostrar guías (no imprimen)
                </label>
              </>
            ) : null}

            <SelectField
              label="Talla"
              value={selectedSizeId}
              onChange={(e) => setSelectedSizeId(e.target.value)}
              options={[
                { value: "", label: "Selecciona una talla…" },
                ...sizes.map((s) => ({ value: String(s.id), label: s.name })),
              ]}
              className="sm:col-span-2"
              disabled={!sizes.length || sizesStatus === "loading"}
            />
            <Field
              label="Cantidad"
              value={qtyDraft}
              onChange={(e) => setQtyDraft(e.target.value)}
              inputMode="numeric"
              placeholder="Ej. 6"
              className="sm:col-span-2"
            />

            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <BigButton className="w-full" onClick={addToSheet}>
                Agregar a hoja
              </BigButton>
              <BigButton
                className="w-full"
                variant="secondary"
                onClick={clearSheet}
              >
                Limpiar hoja
              </BigButton>
            </div>

            <div className="sm:col-span-2 text-sm font-semibold text-slate-600">
              Etiquetas en hoja:{" "}
              <span className="font-extrabold tabular-nums">
                {sheet.length}
              </span>{" "}
              · Hojas:{" "}
              <span className="font-extrabold tabular-nums">
                {estimatedPages}
              </span>
            </div>

            <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-sm font-extrabold text-slate-700">
                Conteo por talla
              </div>
              {sheetCounts.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {sheetCounts.map((r) => (
                    <div
                      key={r.sizeId}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                    >
                      <span className="max-w-[14rem] truncate">{r.name}</span>
                      <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-extrabold tabular-nums text-white">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm font-semibold text-slate-600">
                  Aún no agregas tallas a la hoja.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
              <BigButton
                className="w-full"
                onClick={() => downloadSvg("values")}
              >
                Descargar SVG
              </BigButton>
              <BigButton
                className="w-full"
                variant="secondary"
                onClick={() => downloadSvg("variables")}
              >
                SVG con variables
              </BigButton>
              <BigButton
                className="w-full"
                variant="secondary"
                onClick={printSheet}
              >
                Imprimir
              </BigButton>
            </div>
          </div>
        </section>

        <section className="space-y-4 print:space-y-0">
          <div className="print:hidden">
            <div className="text-lg font-extrabold tracking-tight">
              Vista previa
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Plantilla vectorial con líneas de corte (0.5pt) y capa CUT_LINE.
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 print:hidden">
              <div>
                <div className="text-lg font-extrabold tracking-tight">
                  Hoja imprimible
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  A4 · 6 etiquetas · apertura hacia abajo
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 print:mt-0 print:ring-0 print:p-0">
              {sheetPages.map((page, pageIndex) => {
                const filled = Array.from({ length: SHEET_PAGE_SIZE }).map(
                  (_, idx) => {
                    const item = page[idx] || null;
                    if (!item) return null;
                    const s = sizesById[String(item.sizeId || "")] || null;
                    if (!s) return { id: item.id, size: "" };
                    return {
                      id: item.id,
                      size: s.name,
                      lines: s.lines,
                      fontFamily: FIXED_FONT_FAMILY_SVG,
                      fontWeight: FIXED_FONT_WEIGHT,
                      fontSizeMm: s.fontSizeMm,
                      lineGapMm: s.lineGapMm,
                      yOffsetMm: s.yOffsetMm,
                      sideOffsetMm: s.sideOffsetMm,
                      letterSpacingMm: s.letterSpacingMm,
                    };
                  },
                );

                return (
                  <div
                    key={`page-${pageIndex}`}
                    className={pageIndex ? "print:break-before-page" : ""}
                  >
                    <A4TemplateSvg
                      svgRef={(node) => {
                        if (node) svgRefsValues.current[pageIndex] = node;
                      }}
                      outerDiameterMm={outerD}
                      innerDiameterMm={innerD}
                      slitWidthMm={slitW}
                      logoUrl={logoPng}
                      labels={filled}
                      showGuides={showGuides}
                      variablesMode={false}
                    />

                    <div className="hidden">
                      <A4TemplateSvg
                        svgRef={(node) => {
                          if (node) svgRefsVariables.current[pageIndex] = node;
                        }}
                        outerDiameterMm={outerD}
                        innerDiameterMm={innerD}
                        slitWidthMm={slitW}
                        logoUrl={logoPng}
                        labels={filled}
                        showGuides={showGuides}
                        variablesMode={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
