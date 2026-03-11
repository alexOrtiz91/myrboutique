import { useEffect, useMemo, useState } from "react";
import BarcodeCanvas from "../components/BarcodeCanvas.jsx";
import BigButton from "../components/BigButton.jsx";
import QrImage from "../components/QrImage.jsx";
import Field from "../components/Field.jsx";
import SelectField from "../components/SelectField.jsx";
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

function LabelPreview({ category, product, codeType, codeText }) {
  return (
    <div className="w-full rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-extrabold tracking-tight">
            {category?.name || "—"}
          </div>
          <div className="mt-1 text-base font-extrabold tabular-nums">
            {product?.talla ? `Talla ${product.talla} · ` : ""}$
            {category?.price ?? 0}
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
        {product?.talla ? `${codeText} · Talla ${product.talla}` : codeText}
      </div>
    </div>
  );
}

function PrintableLabel({ category, product, codeType, codeText }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3 print:flex print:h-full print:w-full print:flex-col print:items-center print:justify-center print:gap-[0.1mm] print:overflow-hidden print:rounded-none print:border-0 print:bg-transparent print:p-0 print:text-center">
      <div className="text-sm font-extrabold tracking-tight print:text-[4px] print:leading-tight">
        {category?.name || "—"}
      </div>
      <div className="text-sm font-extrabold tabular-nums print:text-[4px] print:leading-tight">
        {product?.talla ? `T ${product.talla}` : ""}
      </div>
      <div className="text-sm font-extrabold tabular-nums print:text-[4px] print:leading-tight">
        ${category?.price ?? 0}
      </div>
      <div className="mt-2 print:mt-0">
        {codeType === "qr" ? (
          <div className="mx-auto w-28 print:w-[10mm]">
            <QrImage text={codeText} />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[240px] print:max-w-none">
            <BarcodeCanvas text={codeText} />
          </div>
        )}
      </div>
      <div className="mt-2 text-center text-[10px] font-semibold text-slate-700 print:mt-0 print:text-[3.6px] print:leading-tight">
        {product?.talla ? `${codeText} · ${product.talla}` : codeText}
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
  const [codeType, setCodeType] = useState("qr");
  const [sheetCount, setSheetCount] = useState(String(SHEET_PAGE_SIZE));
  const [sheet, setSheet] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiGet("/api/db/health");
        const catRes = await apiGet("/api/catalog/categories");
        const prodRes = await apiGet("/api/catalog/products");
        if (!alive) return;
        setCategories(catRes?.categories || []);
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
    <div className="space-y-5 print:space-y-0">
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
            Selecciona categoría, producto y tipo de código.
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
              label="Producto"
              value={effectiveSelectedProductCode}
              onChange={(e) => setSelectedProductCode(e.target.value)}
              options={productsForSelection.map((p) => ({
                value: p.code,
                label: `${p.code} · ${getProductName(p) || "—"}`,
              }))}
              className="sm:col-span-2"
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
                codeType={codeType}
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

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 print:mt-0 print:ring-0 print:p-0">
              {sheetPages.map((page, pageIndex) => (
                <div
                  key={pageIndex}
                  className={[
                    "rounded-2xl bg-white p-4 ring-1 ring-slate-200",
                    "print:rounded-none print:p-0 print:ring-0",
                    pageIndex === sheetPages.length - 1
                      ? ""
                      : "print:break-after-page",
                  ].join(" ")}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-8 print:gap-0 print:border print:border-slate-300">
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
                          key={item?.id || `empty-${pageIndex}-${idx}`}
                          className={[
                            "h-full w-full",
                            "print:h-[20.8mm] print:overflow-hidden",
                            hasRight
                              ? "print:border-r print:border-slate-300"
                              : "",
                            hasBottom
                              ? "print:border-b print:border-slate-300"
                              : "",
                          ].join(" ")}
                        >
                          {item ? (
                            <PrintableLabel
                              category={category}
                              product={product}
                              codeType={item.codeType}
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
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
