import { useEffect, useMemo, useRef, useState } from "react";
import BigButton from "../components/BigButton.jsx";
import QrImage from "../components/QrImage.jsx";
import Field from "../components/Field.jsx";
import SelectField from "../components/SelectField.jsx";
import ModalDialog from "../components/ModalDialog.jsx";
import { apiGet } from "../api.js";
import {
  getCategoryById,
  getProductByCode,
  getProductName,
} from "../mocks/catalog.js";

const STORAGE_KEY = "myrboutique:tienda-admin:v1";
const PRINT_COLS = 8;
const PRINT_ROWS = 14;
const SHEET_PAGE_SIZE = PRINT_COLS * PRINT_ROWS;

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

function LabelPreview({ category, product, codeText }) {
  return (
    <div className="w-full rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tracking-tight">
            {category?.name || "—"}
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">
            {product?.talla ? `Talla ${product.talla}` : ""}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
          QR
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="mx-auto w-36">
          <QrImage text={codeText} />
        </div>
      </div>

      <div className="mt-3 text-center text-xl font-extrabold text-slate-800">
        {product?.talla ? `${codeText} · Talla ${product.talla}` : codeText}
      </div>
    </div>
  );
}

function PrintableLabel({ category, product, codeText }) {
  return (
    <div className="h-full w-full bg-white p-2 print:flex print:h-full print:w-full print:flex-col print:items-center print:justify-center print:gap-[0.1mm] print:overflow-hidden print:bg-transparent print:p-0 print:text-center">
      <div className="text-[11px] font-extrabold tracking-tight print:text-[5.4px] print:leading-[1.05]">
        {category?.name || "—"}
      </div>
      <div className="text-[12px] font-extrabold tabular-nums print:text-[7px] print:leading-[1.05]">
        {product?.talla ? `T ${product.talla}` : ""}
      </div>
      <div className="mt-2 print:mt-0">
        <div className="mx-auto w-28 print:w-[11mm]">
          <QrImage text={codeText} />
        </div>
      </div>
      <div className="mt-2 text-center text-[14px] font-extrabold tabular-nums text-slate-900 print:mt-0 print:text-[6.4px] print:leading-[1.05]">
        {codeText}
      </div>
    </div>
  );
}

export default function EtiquetasPage() {
  const [dialog, setDialog] = useState(null);
  const dialogResolveRef = useRef(null);
  const sheetQtyDirtyRef = useRef({});

  function openDialog(next) {
    return new Promise((resolve) => {
      dialogResolveRef.current = resolve;
      setDialog(next);
    });
  }

  async function showAlert(text, title) {
    await openDialog({
      kind: "alert",
      title: String(title || "Aviso"),
      text: String(text || ""),
    });
  }

  async function showConfirm(text, title) {
    const r = await openDialog({
      kind: "confirm",
      title: String(title || "Confirmar"),
      text: String(text || ""),
      confirmLabel: "Continuar",
      cancelLabel: "Cancelar",
    });
    return Boolean(r);
  }

  const [categories, setCategories] = useState(() => {
    const persisted = readJson(STORAGE_KEY);
    if (Array.isArray(persisted?.categories) && persisted.categories.length) {
      return persisted.categories.map((c) => {
        const normalPrice = Number(c?.price ?? 0);
        const safeNormalPrice =
          Number.isFinite(normalPrice) && normalPrice >= 0 ? normalPrice : 0;

        const wholesaleCandidate = Number(c?.wholesalePrice ?? safeNormalPrice);
        const safeWholesalePrice =
          Number.isFinite(wholesaleCandidate) && wholesaleCandidate >= 0
            ? wholesaleCandidate
            : safeNormalPrice;

        const creditCandidate = Number(c?.creditPrice ?? safeNormalPrice);
        const safeCreditPrice =
          Number.isFinite(creditCandidate) && creditCandidate >= 0
            ? creditCandidate
            : safeNormalPrice;

        return {
          ...c,
          price: safeNormalPrice,
          creditPrice: safeCreditPrice,
          wholesalePrice: safeWholesalePrice,
        };
      });
    }
    return [];
  });
  const [products, setProducts] = useState(() => {
    const persisted = readJson(STORAGE_KEY);
    if (Array.isArray(persisted?.products) && persisted.products.length)
      return persisted.products;
    return [];
  });
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [selectedProductCode, setSelectedProductCode] = useState(
    products[0]?.code || "",
  );
  const [sheetCount, setSheetCount] = useState(String(SHEET_PAGE_SIZE));
  const [sheet, setSheet] = useState([]);
  const [sheetQtyDraftByCode, setSheetQtyDraftByCode] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiGet("/api/db/health");
        const catRes = await apiGet("/api/catalog/categories");
        const prodRes = await apiGet("/api/catalog/products");
        if (!alive) return;
        const nextCategories = (catRes?.categories || []).map((c) => {
          const normalPrice = Number(c?.price ?? 0);
          const safeNormalPrice =
            Number.isFinite(normalPrice) && normalPrice >= 0 ? normalPrice : 0;

          const wholesaleCandidate = Number(
            c?.wholesalePrice ?? safeNormalPrice,
          );
          const safeWholesalePrice =
            Number.isFinite(wholesaleCandidate) && wholesaleCandidate >= 0
              ? wholesaleCandidate
              : safeNormalPrice;

          const creditCandidate = Number(c?.creditPrice ?? safeNormalPrice);
          const safeCreditPrice =
            Number.isFinite(creditCandidate) && creditCandidate >= 0
              ? creditCandidate
              : safeNormalPrice;

          return {
            ...c,
            price: safeNormalPrice,
            creditPrice: safeCreditPrice,
            wholesalePrice: safeWholesalePrice,
          };
        });
        setCategories(nextCategories);
        setProducts(prodRes?.products || []);
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

  const productsForSelection = useMemo(() => {
    return products.filter((p) =>
      effectiveCategoryId ? p.categoryId === effectiveCategoryId : true,
    );
  }, [products, effectiveCategoryId]);

  const effectiveSelectedProductCode = useMemo(() => {
    const first = productsForSelection[0]?.code || "";
    if (!first) return "";
    return productsForSelection.some((p) => p.code === selectedProductCode)
      ? selectedProductCode
      : first;
  }, [productsForSelection, selectedProductCode]);

  const selectedProduct = useMemo(
    () => getProductByCode(products, effectiveSelectedProductCode),
    [products, effectiveSelectedProductCode],
  );

  const codeText = useMemo(() => {
    if (!selectedProduct) return "";
    return String(selectedProduct.code || "").trim();
  }, [selectedProduct]);

  const sheetPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < sheet.length; i += SHEET_PAGE_SIZE) {
      pages.push(sheet.slice(i, i + SHEET_PAGE_SIZE));
    }
    return pages;
  }, [sheet]);

  function addToSheet() {
    const n = Number(sheetCount || 0);
    if (!Number.isFinite(n) || n <= 0) return;
    const category = selectedCategory;
    if (!category) return;
    const product = selectedProduct;
    if (!product) return;
    const ct = codeText;
    if (!ct) return;

    setSheet((prev) => {
      const next = [...prev];
      for (let i = 0; i < Math.min(2000, n); i += 1) {
        next.push({
          id: `${Date.now()}-${Math.random()}-${i}`,
          categoryId: category.id,
          productCode: product.code,
          codeText: ct,
        });
      }
      return next;
    });
  }

  function removeFromSheetByProductCode(productCode, qtyToRemove) {
    const code = String(productCode || "").trim();
    if (!code) return;
    const n = Number.parseInt(String(qtyToRemove || 0), 10);
    const qty = Number.isFinite(n) ? Math.floor(n) : 0;
    if (qty <= 0) return;
    setSheet((prev) => {
      let remaining = qty;
      if (remaining <= 0) return prev;
      const out = [];
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        const it = prev[i];
        if (remaining > 0 && String(it?.productCode || "").trim() === code) {
          remaining -= 1;
          continue;
        }
        out.push(it);
      }
      out.reverse();
      return out;
    });
  }

  function addToSheetByProductCode(productCode, qtyToAdd) {
    const code = String(productCode || "").trim();
    if (!code) return;
    const n = Number.parseInt(String(qtyToAdd || 0), 10);
    const qty = Number.isFinite(n) ? Math.floor(n) : 0;
    if (qty <= 0) return;
    const product = getProductByCode(products, code);
    if (!product) return;
    const ct = String(product?.code || "").trim();
    if (!ct) return;

    setSheet((prev) => {
      const next = [...prev];
      for (let i = 0; i < Math.min(2000, qty); i += 1) {
        next.push({
          id: `${Date.now()}-${Math.random()}-${i}`,
          categoryId: String(product?.categoryId || "").trim(),
          productCode: product.code,
          codeText: ct,
        });
      }
      return next;
    });
  }

  const sheetTallajeSummary = useMemo(() => {
    const map = new Map();
    for (const it of sheet) {
      const code = String(it?.productCode || "").trim();
      if (!code) continue;
      map.set(code, (map.get(code) || 0) + 1);
    }

    const rows = [];
    for (const [code, qty] of map.entries()) {
      const product = getProductByCode(products, code);
      const category = getCategoryById(categories, product?.categoryId || "");
      const talla = String(product?.talla ?? "").trim();
      rows.push({
        productCode: code,
        qty,
        talla,
        categoryName: category?.name || "—",
      });
    }

    rows.sort((a, b) => {
      if (a.categoryName !== b.categoryName)
        return a.categoryName.localeCompare(b.categoryName);
      if (a.talla !== b.talla) return a.talla.localeCompare(b.talla);
      return a.productCode.localeCompare(b.productCode);
    });

    return rows;
  }, [sheet, products, categories]);

  useEffect(() => {
    setSheetQtyDraftByCode((prev) => {
      const next = { ...(prev || {}) };
      const alive = new Set();
      for (const row of sheetTallajeSummary) {
        const key = String(row.productCode || "").trim();
        if (!key) continue;
        alive.add(key);
        if (sheetQtyDirtyRef.current?.[key]) continue;
        next[key] = String(row.qty);
      }
      for (const key of Object.keys(next)) {
        if (!alive.has(key)) {
          delete next[key];
          if (sheetQtyDirtyRef.current?.[key])
            delete sheetQtyDirtyRef.current[key];
        }
      }
      return next;
    });
  }, [sheetTallajeSummary]);

  async function clearSheet() {
    if (!sheet.length) return;
    const ok = await showConfirm(
      `Vas a limpiar la hoja (${sheet.length} etiquetas). ¿Continuar?`,
      "Etiquetas",
    );
    if (!ok) return;
    setSheet([]);
    setSheetQtyDraftByCode({});
    sheetQtyDirtyRef.current = {};
  }

  function printSheet() {
    window.print();
  }

  async function removeAllFromSheetByProductCode(productCode, currentQty) {
    const code = String(productCode || "").trim();
    if (!code) return;
    const qty = Number(currentQty || 0);
    const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
    if (!safeQty) return;
    const ok = await showConfirm(
      `Vas a borrar ${safeQty} etiquetas de esta talla. ¿Continuar?`,
      "Etiquetas",
    );
    if (!ok) return;
    removeFromSheetByProductCode(code, safeQty);
    sheetQtyDirtyRef.current[code] = false;
  }

  async function applyDesiredQty(productCode) {
    const code = String(productCode || "").trim();
    if (!code) return;
    const row = sheetTallajeSummary.find((r) => r.productCode === code) || null;
    const currentQty = Number(row?.qty || 0);
    const current =
      Number.isFinite(currentQty) && currentQty > 0
        ? Math.floor(currentQty)
        : 0;

    const draft = sheetQtyDraftByCode?.[code];
    const n = Number.parseInt(String(draft || 0), 10);
    const desired = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    const delta = desired - current;
    if (!delta) return;

    if (delta < 0) {
      const ok = await showConfirm(
        `Vas a quitar ${Math.abs(delta)} etiquetas. ¿Continuar?`,
        "Etiquetas",
      );
      if (!ok) return;
      removeFromSheetByProductCode(code, Math.abs(delta));
      sheetQtyDirtyRef.current[code] = false;
      return;
    }

    addToSheetByProductCode(code, delta);
    sheetQtyDirtyRef.current[code] = false;
  }

  return (
    <div className="space-y-5 print:space-y-0">
      <ModalDialog
        open={Boolean(dialog)}
        kind={dialog?.kind}
        title={dialog?.title}
        text={dialog?.text}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        onCancel={() => {
          const resolve = dialogResolveRef.current;
          dialogResolveRef.current = null;
          setDialog(null);
          resolve?.(false);
        }}
        onConfirm={() => {
          const resolve = dialogResolveRef.current;
          dialogResolveRef.current = null;
          setDialog(null);
          resolve?.(true);
        }}
      />
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
      <h1 className="text-2xl font-extrabold tracking-tight print:hidden">
        Etiquetas
      </h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6 print:hidden">
          <div className="text-lg font-extrabold tracking-tight">
            Generar etiqueta
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Selecciona categoría y producto.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Categoría"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
            <SelectField
              label="Producto"
              value={effectiveSelectedProductCode}
              onChange={(e) => setSelectedProductCode(e.target.value)}
              options={productsForSelection.map((p) => ({
                value: p.code,
                label: `${p.code} · ${getProductName(p) || "—"}`,
              }))}
              className="sm:col-span-2"
            />

            <Field
              label="Cantidad de etiquetas"
              value={sheetCount}
              onChange={(e) => setSheetCount(e.target.value)}
              inputMode="numeric"
              placeholder="Ej. 112"
            />

            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <BigButton className="w-full" onClick={addToSheet}>
                Agregar a hoja
              </BigButton>
              <BigButton
                className="w-full"
                variant="secondary"
                onClick={() => void clearSheet()}
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

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div>
              <div className="text-base font-extrabold tracking-tight">
                Conteo por talla y categoría
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Escribe la cantidad final por talla y presiona “Aplicar”.
              </div>
            </div>

            {!sheetTallajeSummary.length ? (
              <div className="mt-3 text-sm font-semibold text-slate-600">
                Sin etiquetas en la hoja.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {sheetTallajeSummary.map((row) => (
                  <div
                    key={row.productCode}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-extrabold text-slate-900">
                        {row.categoryName}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-600">
                        {row.talla ? `Talla ${row.talla}` : "Talla —"} ·{" "}
                        <span className="font-extrabold tabular-nums">
                          {row.productCode}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        value={sheetQtyDraftByCode?.[row.productCode] ?? ""}
                        onChange={(e) => {
                          sheetQtyDirtyRef.current[row.productCode] = true;
                          setSheetQtyDraftByCode((prev) => ({
                            ...(prev || {}),
                            [row.productCode]: e.target.value,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void applyDesiredQty(row.productCode);
                          }
                        }}
                        inputMode="numeric"
                        type="number"
                        min="0"
                        step="1"
                        className={[
                          "h-12 w-20 rounded-2xl bg-white px-3 text-base font-extrabold tabular-nums text-slate-900",
                          "ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900",
                        ].join(" ")}
                      />

                      <button
                        type="button"
                        onClick={() => void applyDesiredQty(row.productCode)}
                        className="h-12 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                      >
                        Aplicar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void removeAllFromSheetByProductCode(
                            row.productCode,
                            row.qty,
                          )
                        }
                        className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-base font-extrabold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                        aria-label="Borrar todas"
                        title="Borrar todas"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 print:space-y-0">
          <div className="print:hidden">
            <div className="text-lg font-extrabold tracking-tight">
              Vista previa
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Así se verá una etiqueta individual.
            </div>
            <div className="mt-3">
              <LabelPreview
                category={selectedCategory}
                product={selectedProduct}
                codeText={codeText}
              />
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 print:hidden">
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

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 overflow-auto print:mt-0 print:ring-0 print:p-0 print:overflow-visible">
              {sheetPages.map((page, pageIndex) => (
                <div
                  key={pageIndex}
                  className={[
                    "rounded-2xl bg-white p-4 ring-1 ring-slate-200",
                    "print:min-w-0 print:rounded-none print:p-0 print:ring-0",
                    pageIndex === sheetPages.length - 1
                      ? ""
                      : "print:break-after-page",
                  ].join(" ")}
                >
                  <div className="print:hidden">
                    <div className="grid grid-cols-2 gap-0 border border-slate-300 sm:grid-cols-4">
                      {Array.from({ length: SHEET_PAGE_SIZE }).map((_, idx) => {
                        const item = page[idx] || null;
                        const product = item
                          ? getProductByCode(products, item.productCode)
                          : null;
                        const category = getCategoryById(
                          categories,
                          product?.categoryId || item?.categoryId,
                        );

                        const col = idx % 4;
                        const row = Math.floor(idx / 4);
                        const rowsTotal = Math.ceil(SHEET_PAGE_SIZE / 4);
                        const hasRight = col !== 3;
                        const hasBottom = row !== rowsTotal - 1;

                        return (
                          <div
                            key={item?.id || `screen-${pageIndex}-${idx}`}
                            className={[
                              "relative h-[210px] w-full overflow-hidden",
                              "border-slate-300",
                              hasRight ? "border-r" : "",
                              hasBottom ? "border-b" : "",
                            ].join(" ")}
                          >
                            {item ? (
                              <PrintableLabel
                                category={category}
                                product={product}
                                codeText={item.codeText}
                              />
                            ) : (
                              <div className="h-full w-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className="hidden print:block mx-auto w-full"
                    style={{ aspectRatio: "210 / 297" }}
                  >
                    <div
                      className="grid h-full w-full border border-slate-300 print:border print:border-slate-300"
                      style={{
                        gridTemplateColumns: `repeat(${PRINT_COLS}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${PRINT_ROWS}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: SHEET_PAGE_SIZE }).map((_, idx) => {
                        const item = page[idx] || null;
                        const product = item
                          ? getProductByCode(products, item.productCode)
                          : null;
                        const category = getCategoryById(
                          categories,
                          product?.categoryId || item?.categoryId,
                        );

                        const col = idx % PRINT_COLS;
                        const row = Math.floor(idx / PRINT_COLS);
                        const hasRight = col !== PRINT_COLS - 1;
                        const hasBottom = row !== PRINT_ROWS - 1;

                        return (
                          <div
                            key={item?.id || `print-${pageIndex}-${idx}`}
                            className={[
                              "relative h-full w-full overflow-hidden",
                              "border-slate-300",
                              hasRight ? "border-r" : "",
                              hasBottom ? "border-b" : "",
                              "print:h-[20.8mm] print:overflow-hidden",
                            ].join(" ")}
                          >
                            {item ? (
                              <PrintableLabel
                                category={category}
                                product={product}
                                codeText={item.codeText}
                              />
                            ) : (
                              <div className="h-full w-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
