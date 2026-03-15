import { useEffect, useMemo, useState } from "react";
import SelectField from "../components/SelectField.jsx";
import BigButton from "../components/BigButton.jsx";
import { apiGet } from "../api.js";
import { getCategoryById } from "../mocks/catalog.js";

const STORAGE_KEY = "myrboutique:tienda-admin:v1";
const MOVEMENTS_PAGE_SIZE = 50;

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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateDMY(value) {
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "";
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  } catch {
    return "";
  }
}

function formatTime24H(value) {
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function InventarioPage() {
  const [persisted] = useState(() => readJson(STORAGE_KEY));
  const [dataSource, setDataSource] = useState("local");
  const [view, setView] = useState("categories");

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
  const [openCategoryId, setOpenCategoryId] = useState("");
  const [movements, setMovements] = useState([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsHasMore, setMovementsHasMore] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsCategoryId, setMovementsCategoryId] = useState("");

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

  const movementCategoryOptions = useMemo(() => {
    const base = Array.isArray(categories) ? categories : [];
    const options = [
      { value: "", label: "Todas" },
      ...base
        .map((c) => ({
          value: String(c?.id || "").trim(),
          label: String(c?.name || "").trim() || String(c?.id || "").trim(),
        }))
        .filter((o) => o.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    return options;
  }, [categories]);

  async function refreshMovements(branchId, page, categoryId) {
    const b = String(branchId || "").trim();
    if (!b) return;
    const p = Math.max(1, Math.floor(Number(page) || 1));
    const c = String(categoryId || "").trim();
    setMovementsLoading(true);
    try {
      const url =
        `/api/inventory/movements?branchId=${encodeURIComponent(b)}` +
        `&page=${encodeURIComponent(p)}` +
        `&limit=${encodeURIComponent(MOVEMENTS_PAGE_SIZE)}` +
        (c ? `&categoryId=${encodeURIComponent(c)}` : "");
      const r = await apiGet(url);
      const next = Array.isArray(r?.movements) ? r.movements : [];
      setMovements(next);
      setMovementsHasMore(Boolean(r?.hasMore));
      setMovementsPage(Number(r?.page ?? p) || p);
    } catch (e) {
      setMovements([]);
      setMovementsHasMore(false);
      void e;
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    if (dataSource !== "api") return;
    if (!effectiveBranchId) return;
    if (view !== "movements") return;
    void refreshMovements(effectiveBranchId, movementsPage, movementsCategoryId);
  }, [
    dataSource,
    effectiveBranchId,
    view,
    movementsPage,
    movementsCategoryId,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventario</h1>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            {view === "movements"
              ? "Movimientos de inventario."
              : "Inventario por categoría (solo lectura)."}
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
            setMovementsPage(1);
          }}
          options={branchOptions}
          className="sm:min-w-[240px]"
        />
      </div>

      <section className="space-y-4">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-extrabold tracking-tight">
              {view === "movements"
                ? "Movimientos de inventario"
                : "Inventario por categoría"}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {view === "movements" ? (
                <SelectField
                  label="Categoría"
                  value={movementsCategoryId}
                  disabled={dataSource !== "api"}
                  onChange={(e) => {
                    setMovementsCategoryId(e.target.value);
                    setMovementsPage(1);
                  }}
                  options={movementCategoryOptions}
                  className="sm:min-w-[240px]"
                />
              ) : null}
              <BigButton
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  setOpenCategoryId("");
                  setMovementsPage(1);
                  setView((prev) =>
                    prev === "movements" ? "categories" : "movements",
                  );
                }}
              >
                {view === "movements" ? "Ver inventario" : "Ver movimientos"}
              </BigButton>
            </div>
          </div>

          {view === "movements" ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-slate-600">
                  Página{" "}
                  <span className="font-extrabold tabular-nums">
                    {movementsPage}
                  </span>
                </div>
                <div className="flex gap-2">
                  <BigButton
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={movementsLoading || movementsPage <= 1}
                    onClick={() =>
                      setMovementsPage((p) => Math.max(1, Number(p) - 1))
                    }
                  >
                    Anterior
                  </BigButton>
                  <BigButton
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={movementsLoading || !movementsHasMore}
                    onClick={() => setMovementsPage((p) => Number(p) + 1)}
                  >
                    Siguiente
                  </BigButton>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <div className="col-span-2">Fecha</div>
                  <div className="col-span-1">Hora</div>
                  <div className="col-span-3">Tipo</div>
                  <div className="col-span-1 text-right">Cantidad</div>
                  <div className="col-span-3">Categoría</div>
                  <div className="col-span-2">Producto</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {movementsLoading ? (
                    <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                      Cargando movimientos…
                    </div>
                  ) : movements.length ? (
                    movements.map((m) => {
                      const id = String(m?.id || "").trim();
                      const date = formatDateDMY(m?.createdAt);
                      const time = formatTime24H(m?.createdAt);
                      const reason = String(m?.reason || "").trim();
                      const delta = Number(m?.delta ?? 0);
                      const catName = String(m?.categoryName || "").trim();
                      const code = String(m?.code || "").trim();
                      const talla = String(m?.talla || "").trim();
                      const productLabel = talla ? `${code} · ${talla}` : code;
                      return (
                        <div
                          key={id}
                          className="grid grid-cols-12 gap-2 px-4 py-3 text-sm font-semibold text-slate-900"
                        >
                          <div className="col-span-2 tabular-nums text-slate-700">
                            {date || "—"}
                          </div>
                          <div className="col-span-1 tabular-nums text-slate-700">
                            {time || "—"}
                          </div>
                          <div className="col-span-3 truncate">{reason || "—"}</div>
                          <div className="col-span-1 text-right tabular-nums">
                            {delta}
                          </div>
                          <div className="col-span-3 truncate text-slate-700">
                            {catName || "—"}
                          </div>
                          <div className="col-span-2 tabular-nums">
                            {productLabel || "—"}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                      Sin movimientos
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </section>
    </div>
  );
}
