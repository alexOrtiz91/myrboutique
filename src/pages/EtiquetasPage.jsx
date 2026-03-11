import { useEffect, useMemo, useState } from "react";
import BarcodeCanvas from "../components/BarcodeCanvas.jsx";
import BigButton from "../components/BigButton.jsx";
import QrImage from "../components/QrImage.jsx";
import Field from "../components/Field.jsx";
import SelectField from "../components/SelectField.jsx";
import { apiGet } from "../api.js";
import { getCategoryById } from "../mocks/catalog.js";

const STORAGE_KEY = "myrboutique:tienda-admin:v1";

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

function LabelPreview({ category, codeType, codeText }) {
  return (
    <div className="w-full rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-extrabold tracking-tight">
            {category?.name || "—"}
          </div>
          <div className="mt-1 text-base font-extrabold tabular-nums">
            ${category?.price ?? 0}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
          {codeType === "qr" ? "QR" : "BARCODE"}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        {codeType === "qr" ? (
          <div className="mx-auto w-36">
            <QrImage text={codeText} />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[280px]">
            <BarcodeCanvas text={codeText} />
          </div>
        )}
      </div>

      <div className="mt-2 text-center text-xs font-semibold text-slate-500">
        {codeText}
      </div>
    </div>
  );
}

function PrintableLabel({ category, codeType, codeText }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="text-sm font-extrabold tracking-tight">
        {category?.name || "—"}
      </div>
      <div className="mt-1 text-sm font-extrabold tabular-nums">
        ${category?.price ?? 0}
      </div>
      <div className="mt-2">
        {codeType === "qr" ? (
          <div className="mx-auto w-28">
            <QrImage text={codeText} />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[240px]">
            <BarcodeCanvas text={codeText} />
          </div>
        )}
      </div>
      <div className="mt-2 text-center text-[10px] font-semibold text-slate-700">
        {codeText}
      </div>
    </div>
  );
}

export default function EtiquetasPage() {
  const [categories, setCategories] = useState(() => {
    const persisted = readJson(STORAGE_KEY);
    if (Array.isArray(persisted?.categories) && persisted.categories.length)
      return persisted.categories;
    return [];
  });
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [codeType, setCodeType] = useState("barcode");
  const [codeTextMode, setCodeTextMode] = useState("categoria");
  const [customCodeText, setCustomCodeText] = useState("");
  const [sheetCount, setSheetCount] = useState("12");
  const [sheet, setSheet] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiGet("/api/db/health");
        const catRes = await apiGet("/api/catalog/categories");
        if (!alive) return;
        setCategories(catRes?.categories || []);
      } catch {
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const effectiveCategoryId = useMemo(() => {
    const first = categories[0]?.id || "";
    if (!first) return "";
    return categories.some((c) => c.id === categoryId) ? categoryId : first;
  }, [categories, categoryId]);

  const selectedCategory = useMemo(
    () => getCategoryById(categories, effectiveCategoryId),
    [categories, effectiveCategoryId],
  );

  const codeText = useMemo(() => {
    if (codeTextMode === "custom") return String(customCodeText || "").trim();
    if (!selectedCategory) return "";
    return selectedCategory.id;
  }, [codeTextMode, customCodeText, selectedCategory]);

  function addToSheet() {
    const n = Number(sheetCount || 0);
    if (!Number.isFinite(n) || n <= 0) return;
    const category = selectedCategory;
    if (!category) return;
    const ct = codeText;
    if (!ct) return;

    setSheet((prev) => {
      const next = [...prev];
      for (let i = 0; i < Math.min(200, n); i += 1) {
        next.push({
          id: `${Date.now()}-${Math.random()}-${i}`,
          categoryId: category.id,
          codeType,
          codeText: ct,
        });
      }
      return next;
    });
  }

  function clearSheet() {
    setSheet([]);
  }

  function printSheet() {
    window.print();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Etiquetas</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="no-print rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
          <div className="text-lg font-extrabold tracking-tight">
            Generar etiqueta
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Selecciona categoría y tipo de código.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Categoría"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categories.map((c) => ({
                value: c.id,
                label: `${c.name} ($${c.price} / $${c.wholesalePrice ?? c.price})`,
              }))}
            />
            <SelectField
              label="Tipo de código"
              value={codeType}
              onChange={(e) => setCodeType(e.target.value)}
              options={[
                { value: "barcode", label: "Código de barras (Code128)" },
                { value: "qr", label: "QR" },
              ]}
            />

            <SelectField
              label="Texto del código"
              value={codeTextMode}
              onChange={(e) => setCodeTextMode(e.target.value)}
              options={[
                { value: "categoria", label: "Usar ID de categoría" },
                { value: "custom", label: "Personalizado" },
              ]}
            />
            <Field
              label="Texto personalizado"
              value={customCodeText}
              onChange={(e) => setCustomCodeText(e.target.value)}
              placeholder="Ej. 1001"
              disabled={codeTextMode !== "custom"}
            />

            <Field
              label="Cantidad para hoja"
              value={sheetCount}
              onChange={(e) => setSheetCount(e.target.value)}
              inputMode="numeric"
              placeholder="Ej. 12"
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

            <div className="sm:col-span-2">
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

        <section className="space-y-4">
          <div className="no-print">
            <div className="text-lg font-extrabold tracking-tight">
              Vista previa
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Así se verá una etiqueta individual.
            </div>
            <div className="mt-3">
              <LabelPreview
                category={selectedCategory}
                codeType={codeType}
                codeText={codeText}
              />
            </div>
          </div>

          <div>
            <div className="no-print flex items-end justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold tracking-tight">
                  Hoja imprimible
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  {sheet.length
                    ? `${sheet.length} etiquetas`
                    : "Agrega etiquetas para imprimir"}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 print:ring-0 print:p-0">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sheet.map((item) => (
                  <PrintableLabel
                    key={item.id}
                    category={getCategoryById(categories, item.categoryId)}
                    codeType={item.codeType}
                    codeText={item.codeText}
                  />
                ))}
              </div>
              {!sheet.length ? (
                <div className="no-print mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                  Tip: si vas a usar escaneo por producto, pon “Texto
                  personalizado” con el código del producto (ej. 1001).
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
