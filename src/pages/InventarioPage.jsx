import { useEffect, useMemo, useState } from "react";
import BigButton from "../components/BigButton.jsx";
import Field from "../components/Field.jsx";
import SelectField from "../components/SelectField.jsx";
import { apiGet, apiSend } from "../api.js";
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

function writeJson(key, value) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function getProfileById(profiles, id) {
  return profiles.find((p) => p.id === id) || null;
}

function getDefaultProfileId(profiles) {
  return profiles?.[0]?.id || "";
}

function guessProfileIdFromCategory(category, profiles) {
  if (
    category?.sizeProfileId &&
    getProfileById(profiles, category.sizeProfileId)
  ) {
    return category.sizeProfileId;
  }
  return getDefaultProfileId(profiles);
}

export default function InventarioPage() {
  const [persisted] = useState(() => readJson(STORAGE_KEY));
  const [dataSource, setDataSource] = useState("local");

  const [branches, setBranches] = useState(() => {
    return Array.isArray(persisted?.branches) ? persisted.branches : [];
  });
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return String(persisted?.branchId || "").trim();
  });

  const persistedProfiles = useMemo(() => {
    return Array.isArray(persisted?.sizeProfiles) ? persisted.sizeProfiles : [];
  }, [persisted]);

  const [categories, setCategories] = useState(() => {
    if (Array.isArray(persisted?.categories) && persisted.categories.length)
      return persisted.categories;
    return [];
  });

  const [products, setProducts] = useState(() => {
    const base =
      Array.isArray(persisted?.products) && persisted.products.length
        ? persisted.products
        : [];
    return base.map((p) => ({ ...p, name: p?.name ? String(p.name) : "" }));
  });

  const [stockByProductCode, setStockByProductCode] = useState(() => {
    if (
      persisted?.stockByProductCode &&
      !Array.isArray(persisted.stockByProductCode)
    )
      return persisted.stockByProductCode;
    return {};
  });

  useEffect(() => {
    if (dataSource === "api") return;
    const current = readJson(STORAGE_KEY) || {};
    writeJson(STORAGE_KEY, { ...current, stockByProductCode });
  }, [dataSource, stockByProductCode]);

  const effectiveBranchId = useMemo(() => {
    const desired = String(selectedBranchId || "").trim();
    const normalizedBranches = Array.isArray(branches) ? branches : [];
    if (normalizedBranches.length) {
      const hit = normalizedBranches.find(
        (b) => String(b?.id || "").trim() === desired,
      );
      if (hit) return String(hit.id || "").trim();
      return String(normalizedBranches[0]?.id || "").trim();
    }
    return desired;
  }, [branches, selectedBranchId]);

  const branchOptions = useMemo(() => {
    const normalizedBranches = Array.isArray(branches) ? branches : [];
    if (!normalizedBranches.length) return [];
    return normalizedBranches.map((b) => ({
      value: String(b?.id || "").trim(),
      label: String(b?.name || "").trim(),
    }));
  }, [branches]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiGet("/api/db/health");

        let apiBranches = [];
        try {
          const branchesRes = await apiGet("/api/branches");
          apiBranches = Array.isArray(branchesRes?.branches)
            ? branchesRes.branches
            : [];
        } catch (e) {
          void e;
        }
        if (alive) setBranches(apiBranches);
        const persistedBranchId = String(persisted?.branchId || "").trim();
        const defaultBranchId = apiBranches.some(
          (b) => String(b?.id || "").trim() === persistedBranchId,
        )
          ? persistedBranchId
          : String(apiBranches[0]?.id || "").trim();
        if (alive) setSelectedBranchId(defaultBranchId);

        const stockUrl = defaultBranchId
          ? `/api/inventory/stock?branchId=${encodeURIComponent(defaultBranchId)}`
          : "/api/inventory/stock";
        const [catRes, prodRes, stockRes] = await Promise.all([
          apiGet("/api/catalog/categories"),
          apiGet("/api/catalog/products"),
          apiGet(stockUrl),
        ]);
        if (!alive) return;

        setCategories(catRes?.categories || []);
        setProducts((prodRes?.products || []).map((p) => ({ ...p, name: "" })));
        setStockByProductCode(
          stockRes?.stockByProductCode &&
            !Array.isArray(stockRes.stockByProductCode)
            ? stockRes.stockByProductCode
            : {},
        );
        setDataSource("api");
      } catch {
        if (!alive) return;
        setDataSource("local");
      }
    })();
    return () => {
      alive = false;
    };
  }, [persisted]);

  useEffect(() => {
    if (dataSource !== "api") return;
    if (!effectiveBranchId) return;
    let alive = true;
    (async () => {
      try {
        const r = await apiGet(
          `/api/inventory/stock?branchId=${encodeURIComponent(effectiveBranchId)}`,
        );
        if (!alive) return;
        const next =
          r?.stockByProductCode && !Array.isArray(r.stockByProductCode)
            ? r.stockByProductCode
            : {};
        setStockByProductCode(next);
      } catch (e) {
        if (!alive) return;
        void e;
      }
    })();
    return () => {
      alive = false;
    };
  }, [dataSource, effectiveBranchId]);

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    categories[0]?.id || "",
  );
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [qty, setQty] = useState("1");
  const [openCategoryId, setOpenCategoryId] = useState("");

  const effectiveSelectedCategoryId = useMemo(() => {
    const first = categories[0]?.id || "";
    if (!first) return "";
    return categories.some((c) => c.id === selectedCategoryId)
      ? selectedCategoryId
      : first;
  }, [categories, selectedCategoryId]);

  const productsWithDetails = useMemo(() => {
    return products
      .map((p) => {
        const cat = getCategoryById(categories, p.categoryId);
        const profileId = cat
          ? guessProfileIdFromCategory(cat, persistedProfiles)
          : "";
        const profile = profileId
          ? getProfileById(persistedProfiles, profileId)
          : null;
        return {
          ...p,
          genero: profile?.genero || "",
          categoryName: cat?.name || p.categoryId,
          price: cat?.price ?? 0,
          stock: stockByProductCode?.[p.code] ?? 0,
        };
      })
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [products, categories, persistedProfiles, stockByProductCode]);

  const productsForSelection = useMemo(() => {
    return productsWithDetails.filter((p) =>
      effectiveSelectedCategoryId
        ? p.categoryId === effectiveSelectedCategoryId
        : true,
    );
  }, [productsWithDetails, effectiveSelectedCategoryId]);

  const inventoryByCategory = useMemo(() => {
    const map = {};
    for (const p of productsWithDetails) {
      const categoryId = String(p?.categoryId || "").trim();
      if (!categoryId) continue;
      if (!map[categoryId]) {
        map[categoryId] = {
          categoryId,
          categoryName: p?.categoryName || categoryId,
          items: [],
          totalStock: 0,
        };
      }
      map[categoryId].items.push(p);
      map[categoryId].totalStock += Number(p?.stock ?? 0) || 0;
    }
    const groups = Object.values(map);
    for (const g of groups) {
      g.items.sort((a, b) => {
        const ta = String(a?.talla || "");
        const tb = String(b?.talla || "");
        const tcmp = ta.localeCompare(tb, "es", { numeric: true });
        if (tcmp !== 0) return tcmp;
        return String(a?.code || "").localeCompare(
          String(b?.code || ""),
          "es",
          {
            numeric: true,
          },
        );
      });
    }
    groups.sort((a, b) =>
      String(a?.categoryName || "").localeCompare(
        String(b?.categoryName || ""),
      ),
    );
    return groups;
  }, [productsWithDetails]);

  function toggleCategory(categoryId) {
    const id = String(categoryId || "").trim();
    if (!id) return;
    setOpenCategoryId((prev) => (prev === id ? "" : id));
  }

  const effectiveSelectedProductCode = useMemo(() => {
    const first = productsForSelection[0]?.code || "";
    if (!first) return "";
    return productsForSelection.some((p) => p.code === selectedProductCode)
      ? selectedProductCode
      : first;
  }, [productsForSelection, selectedProductCode]);

  async function adjustStock(delta) {
    const n = Number(qty || 0);
    if (!effectiveSelectedProductCode) return;
    if (!Number.isFinite(n) || n <= 0) return;
    const d = delta * n;
    if (dataSource === "api") {
      try {
        const r = await apiSend("/api/inventory/adjust", "POST", {
          branchId: effectiveBranchId,
          code: effectiveSelectedProductCode,
          delta: d,
          reason: "inventario_demo_adjust",
        });
        const nextQty = Number(r?.qty ?? 0);
        setStockByProductCode((prev) => ({
          ...(prev || {}),
          [effectiveSelectedProductCode]: nextQty,
        }));
      } catch (e) {
        window.alert(String(e?.message || e));
      }
      return;
    }
    setStockByProductCode((prev) => {
      const current = prev?.[effectiveSelectedProductCode] ?? 0;
      return {
        ...(prev || {}),
        [effectiveSelectedProductCode]: Math.max(0, current + d),
      };
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventario</h1>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Ajuste rápido por producto (persistente en este dispositivo).
          </div>
        </div>
        <SelectField
          label="Tienda"
          value={effectiveBranchId}
          disabled={dataSource !== "api"}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedBranchId(id);
            const current = readJson(STORAGE_KEY) || {};
            writeJson(STORAGE_KEY, { ...current, branchId: id });
          }}
          options={branchOptions}
          className="sm:min-w-[240px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
          <div className="text-lg font-extrabold tracking-tight">
            Ajuste rápido
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Categoría"
              value={effectiveSelectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              label="Producto"
              value={effectiveSelectedProductCode}
              onChange={(e) => setSelectedProductCode(e.target.value)}
              options={productsForSelection.map((p) => ({
                value: p.code,
                label: `${p.talla ? `Talla ${p.talla}` : "—"}`,
              }))}
              className="sm:col-span-2"
            />

            <Field
              label="Cantidad"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              placeholder="Ej. 1"
            />

            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <BigButton className="w-full" onClick={() => adjustStock(+1)}>
                Agregar +
              </BigButton>
              <BigButton
                className="w-full"
                variant="danger"
                onClick={() => adjustStock(-1)}
              >
                Quitar -
              </BigButton>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
            <div className="text-lg font-extrabold tracking-tight">
              Inventario por categoría
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <div className="divide-y divide-slate-200 bg-white">
                {inventoryByCategory.map((g) => {
                  const isOpen = openCategoryId === g.categoryId;
                  return (
                    <div key={g.categoryId}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(g.categoryId)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-base font-extrabold">
                            {g.categoryName}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-600">
                            {g.items.length} tallas · Total:{" "}
                            <span className="font-extrabold tabular-nums">
                              {g.totalStock}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-extrabold text-slate-700">
                          {isOpen ? "—" : "+"}
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="border-t border-slate-200 bg-slate-50">
                          <div className="grid grid-cols-12 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                            <div className="col-span-2">Talla</div>
                            <div className="col-span-4">Producto</div>
                            <div className="col-span-3">Género</div>
                            <div className="col-span-2 text-right">Precio</div>
                            <div className="col-span-1 text-right">Stock</div>
                          </div>
                          <div className="divide-y divide-slate-200">
                            {g.items.map((p) => (
                              <div
                                key={p.code}
                                className="grid grid-cols-12 px-4 py-3 text-sm font-semibold text-slate-900"
                              >
                                <div className="col-span-2">
                                  {p.talla || "—"}
                                </div>
                                <div className="col-span-4 tabular-nums">
                                  {p.code}
                                </div>
                                <div className="col-span-3 text-slate-700">
                                  {p.genero || "—"}
                                </div>
                                <div className="col-span-2 text-right tabular-nums text-slate-700">
                                  ${p.price}
                                </div>
                                <div className="col-span-1 text-right tabular-nums">
                                  {p.stock}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {!inventoryByCategory.length ? (
                  <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                    Sin productos
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
