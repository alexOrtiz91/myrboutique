import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BigButton from "../components/BigButton.jsx";
import Field from "../components/Field.jsx";
import SelectField from "../components/SelectField.jsx";
import { apiGet, apiSend } from "../api.js";
import { getCategoryById } from "../mocks/catalog.js";

const fixedGeneros = ["Dama", "Caballero", "Niño", "Bebé"];

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

function toCategoryId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function nextAvailableCategoryId(baseId, categories) {
  if (!categories.some((c) => c.id === baseId)) return baseId;
  let i = 2;
  while (categories.some((c) => c.id === `${baseId}_${i}`)) i += 1;
  return `${baseId}_${i}`;
}

function getProfileById(profiles, id) {
  return profiles.find((p) => p.id === id) || null;
}

function getProfileTallas(profile) {
  if (!profile) return [];
  return Array.isArray(profile.values) ? profile.values : [];
}

function isNumericSizeValue(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
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
  const tallas = category?.tallas || [];
  for (const p of profiles) {
    const v = getProfileTallas(p);
    if (v.length && JSON.stringify(v) === JSON.stringify(tallas)) return p.id;
  }
  return getDefaultProfileId(profiles);
}

function summarizeTallasByProfile(category, profiles) {
  if (!category) return "—";
  const profileId = guessProfileIdFromCategory(category, profiles);
  const profile = getProfileById(profiles, profileId);
  if (!profile) return "—";
  const t = getProfileTallas(profile);
  if (!t.length) return "—";
  const genero = profile?.genero ? `${profile.genero} · ` : "";
  return `${genero}${t.slice(0, 8).join(", ")}${t.length > 8 ? "…" : ""}`;
}

function Panel({ title, subtitle, actions = null, className = "", children }) {
  return (
    <section
      className={[
        "rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-extrabold tracking-tight">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm font-semibold text-slate-600">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="mt-3 sm:mt-0">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function XButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-slate-900 ring-1 ring-slate-200"
      aria-label="Cerrar"
      title="Cerrar"
    >
      ×
    </button>
  );
}

function useDismissableLayer(open, onClose) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e) {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose]);

  return ref;
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl px-5 py-4 text-lg font-extrabold tracking-tight transition",
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-900 ring-1 ring-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function uniqueOrdered(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    const s = String(v || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function SortableTallaRow({ id, value, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "flex touch-none select-none items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1",
        isDragging ? "ring-amber-300" : "ring-slate-200",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200"
      >
        ≡
      </div>
      <div className="min-w-0 flex-1">{value}</div>
      <button
        type="button"
        onPointerDownCapture={(e) => e.stopPropagation()}
        onTouchStartCapture={(e) => e.stopPropagation()}
        onClick={() => onRemove(value)}
        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200"
      >
        Quitar
      </button>
    </div>
  );
}

function ReorderableTallasList({
  profileId,
  values,
  onCommit,
  onRemove,
  onRename,
}) {
  const [items, setItems] = useState(() => uniqueOrdered(values));
  const [reorderMode, setReorderMode] = useState(false);
  const [editingValue, setEditingValue] = useState(null);
  const [draftValue, setDraftValue] = useState("");

  useEffect(() => {
    setItems(uniqueOrdered(values));
    setReorderMode(false);
    setEditingValue(null);
    setDraftValue("");
  }, [profileId, values]);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  function handleDragEnd(event) {
    const activeId = event?.active?.id;
    const overId = event?.over?.id;
    if (!activeId || !overId) return;
    if (activeId === overId) return;

    setItems((prev) => {
      const oldIndex = prev.indexOf(activeId);
      const newIndex = prev.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      return uniqueOrdered(moved);
    });
  }

  return (
    <div className="space-y-2">
      <div
        className={[
          "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ring-1",
          reorderMode
            ? "bg-amber-50 text-amber-900 ring-amber-200"
            : "bg-slate-50 text-slate-600 ring-slate-200",
        ].join(" ")}
      >
        <div>
          {reorderMode
            ? "Modo ordenar activo · arrastra una talla"
            : "Activa modo ordenar para reordenar tallas"}
        </div>
        {reorderMode ? (
          <button
            type="button"
            onClick={() => {
              const next = uniqueOrdered(items);
              onCommit(profileId, next);
              setReorderMode(false);
            }}
            className="rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-slate-900 ring-1 ring-amber-200"
          >
            Listo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReorderMode(true)}
            className="rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-slate-900 ring-1 ring-slate-200"
          >
            Ordenar
          </button>
        )}
      </div>

      {reorderMode ? (
        <div className="touch-none overscroll-contain">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((v) => (
                  <SortableTallaRow
                    key={v}
                    id={v}
                    value={v}
                    onRemove={(value) => onRemove(profileId, value)}
                  />
                ))}
                {!items.length ? (
                  <div className="text-sm font-semibold text-slate-600">—</div>
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((v) => (
            <div
              key={v}
              className="flex select-none items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-slate-200"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                aria-hidden="true"
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200"
              >
                ≡
              </div>
              {editingValue === v ? (
                <>
                  <input
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const to = String(draftValue || "").trim();
                        if (to) onRename(profileId, v, to);
                        setEditingValue(null);
                        setDraftValue("");
                      }
                      if (e.key === "Escape") {
                        setEditingValue(null);
                        setDraftValue("");
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onTouchStartCapture={(e) => e.stopPropagation()}
                    onClick={() => {
                      const to = String(draftValue || "").trim();
                      if (to) onRename(profileId, v, to);
                      setEditingValue(null);
                      setDraftValue("");
                    }}
                    className="rounded-lg bg-white px-2 py-1 text-xs font-extrabold text-slate-900 ring-1 ring-slate-200"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onTouchStartCapture={(e) => e.stopPropagation()}
                    onClick={() => {
                      setEditingValue(null);
                      setDraftValue("");
                    }}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">{v}</div>
                  <button
                    type="button"
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onTouchStartCapture={(e) => e.stopPropagation()}
                    onClick={() => {
                      setEditingValue(v);
                      setDraftValue(v);
                    }}
                    className="rounded-lg bg-white px-2 py-1 text-xs font-extrabold text-slate-900 ring-1 ring-slate-200"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onTouchStartCapture={(e) => e.stopPropagation()}
                    onClick={() => onRemove(profileId, v)}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200"
                  >
                    Quitar
                  </button>
                </>
              )}
            </div>
          ))}
          {!items.length ? (
            <div className="text-sm font-semibold text-slate-600">—</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function TiendaAdminPage() {
  const [persisted] = useState(() => readJson(STORAGE_KEY));
  const [tab, setTab] = useState(() => {
    const raw = String(persisted?.tab || "").trim();
    if (raw === "catalogos") return "catalogos";
    if (raw === "productos") return "productos";
    if (raw === "inventario") return "inventario";
    return "catalogos";
  });
  const [dataSource, setDataSource] = useState("local");
  const [branches, setBranches] = useState(() => {
    return Array.isArray(persisted?.branches) ? persisted.branches : [];
  });
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return String(persisted?.branchId || "").trim();
  });
  const persistedProfiles = useMemo(() => {
    return Array.isArray(persisted?.sizeProfiles) &&
      persisted.sizeProfiles.length
      ? persisted.sizeProfiles
      : [];
  }, [persisted]);

  const [sizeProfiles, setSizeProfiles] = useState(() =>
    persistedProfiles.map((p) => ({
      ...p,
      values: getProfileTallas(p),
    })),
  );

  const [categories, setCategories] = useState(() => {
    const base =
      Array.isArray(persisted?.categories) && persisted.categories.length
        ? persisted.categories
        : [];
    return base.map((c) => {
      const profileId = guessProfileIdFromCategory(c, persistedProfiles);
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
        id: c.id,
        name: c.name,
        price: safeNormalPrice,
        creditPrice: safeCreditPrice,
        wholesalePrice: safeWholesalePrice,
        sizeProfileId: profileId,
        tallas: c.tallas,
        tallasByGenero: c.tallasByGenero,
      };
    });
  });
  const [products, setProducts] = useState(() => {
    const base =
      Array.isArray(persisted?.products) && persisted.products.length
        ? persisted.products
        : [];
    return base.map((p) => ({
      ...p,
      name: p?.name ? String(p.name) : "",
    }));
  });
  const [stockByProductCode, setStockByProductCode] = useState(() => {
    if (
      persisted?.stockByProductCode &&
      !Array.isArray(persisted.stockByProductCode)
    ) {
      return persisted.stockByProductCode;
    }
    return {};
  });

  useEffect(() => {
    writeJson(STORAGE_KEY, {
      tab,
      branchId: selectedBranchId,
      branches,
      sizeProfiles,
      categories,
      products,
      stockByProductCode,
    });
  }, [
    dataSource,
    tab,
    selectedBranchId,
    branches,
    sizeProfiles,
    categories,
    products,
    stockByProductCode,
  ]);

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

        const [catRes, prodRes, stockRes] = await Promise.all([
          apiGet("/api/catalog/categories"),
          apiGet("/api/catalog/products"),
          apiGet(
            `/api/inventory/stock?branchId=${encodeURIComponent(defaultBranchId)}`,
          ),
        ]);
        if (!alive) return;

        let apiProfiles = [];
        try {
          const profilesRes = await apiGet("/api/size-profiles");
          apiProfiles = Array.isArray(profilesRes?.profiles)
            ? profilesRes.profiles
            : [];
          if (apiProfiles.length) {
            const normalized = apiProfiles.map((p) => ({
              ...p,
              values: getProfileTallas(p),
            }));
            setSizeProfiles(normalized);
          }
        } catch (e) {
          void e;
        }

        const defaultApiProfileId = String(apiProfiles[0]?.id || "").trim();
        const fallbackProfileId = getDefaultProfileId(persistedProfiles);
        const defaultProfileId = defaultApiProfileId || fallbackProfileId;

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
          const profileId =
            String(c?.sizeProfileId || "").trim() || defaultProfileId;
          return {
            id: c.id,
            name: c.name,
            price: safeNormalPrice,
            creditPrice: safeCreditPrice,
            wholesalePrice: safeWholesalePrice,
            sizeProfileId: profileId,
          };
        });

        const nextProducts = (prodRes?.products || []).map((p) => ({
          ...p,
          name: "",
        }));
        const nextStock =
          stockRes?.stockByProductCode &&
          !Array.isArray(stockRes.stockByProductCode)
            ? stockRes.stockByProductCode
            : {};

        setCategories(nextCategories);
        setProducts(nextProducts);
        setStockByProductCode(nextStock);
        setDataSource("api");
      } catch {
        if (!alive) return;
        setDataSource("local");
      }
    })();
    return () => {
      alive = false;
    };
  }, [persistedProfiles]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPrice, setNewCategoryPrice] = useState("");
  const [newCategoryCreditPrice, setNewCategoryCreditPrice] = useState("");
  const [newCategoryWholesalePrice, setNewCategoryWholesalePrice] =
    useState("");
  const [newCategorySizeProfile, setNewCategorySizeProfile] = useState("");

  const [newSizeProfileLabel, setNewSizeProfileLabel] = useState("");
  const [newSizeProfileGenero, setNewSizeProfileGenero] = useState("");
  const [profileValueDraft, setProfileValueDraft] = useState({});

  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateSizeProfileOpen, setIsCreateSizeProfileOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [isQuickAdjustOpen, setIsQuickAdjustOpen] = useState(false);
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [newProductTalla, setNewProductTalla] = useState("");

  const [stockCategoryId, setStockCategoryId] = useState("");
  const [stockProductCode, setStockProductCode] = useState("");
  const [stockDelta, setStockDelta] = useState("");

  const [editingInventoryProductCode, setEditingInventoryProductCode] =
    useState(null);
  const [inventoryStockDraft, setInventoryStockDraft] = useState("");

  const [selectedCatalogCategoryId, setSelectedCatalogCategoryId] =
    useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryPrice, setEditCategoryPrice] = useState("");
  const [editCategoryCreditPrice, setEditCategoryCreditPrice] = useState("");
  const [editCategoryWholesalePrice, setEditCategoryWholesalePrice] =
    useState("");
  const [editCategoryProfileId, setEditCategoryProfileId] = useState("");

  const [selectedProductCode, setSelectedProductCode] = useState(null);
  const [editingProductCode, setEditingProductCode] = useState(null);
  const [editProductCategoryId, setEditProductCategoryId] = useState("");
  const [editProductTalla, setEditProductTalla] = useState("");

  const closeAllCatalogForms = useCallback(() => {
    setIsCreateCategoryOpen(false);
    setIsCreateSizeProfileOpen(false);
    setIsCreateProductOpen(false);
    setIsQuickAdjustOpen(false);
    setIsCreateBranchOpen(false);
    setEditingCategoryId(null);
    setEditingProfileId(null);
    setSelectedProductCode(null);
    setEditingProductCode(null);
    setEditingInventoryProductCode(null);
    setInventoryStockDraft("");
  }, []);

  const closeInventoryAdjustRow = useCallback(() => {
    setEditingInventoryProductCode(null);
  }, []);

  const openCreateCategory = useCallback(() => {
    closeAllCatalogForms();
    setIsCreateCategoryOpen(true);
  }, [closeAllCatalogForms]);

  const openCreateSizeProfile = useCallback(() => {
    closeAllCatalogForms();
    setIsCreateSizeProfileOpen(true);
  }, [closeAllCatalogForms]);

  const openCreateProduct = useCallback(() => {
    closeAllCatalogForms();
    setIsCreateProductOpen(true);
  }, [closeAllCatalogForms]);

  const openQuickAdjust = useCallback(() => {
    closeAllCatalogForms();
    setIsQuickAdjustOpen(true);
  }, [closeAllCatalogForms]);

  const openCreateBranch = useCallback(() => {
    closeAllCatalogForms();
    setIsCreateBranchOpen(true);
  }, [closeAllCatalogForms]);

  const createCategoryLayerRef = useDismissableLayer(
    isCreateCategoryOpen,
    closeAllCatalogForms,
  );
  const createSizeProfileLayerRef = useDismissableLayer(
    isCreateSizeProfileOpen,
    closeAllCatalogForms,
  );
  const editCategoryLayerRef = useDismissableLayer(
    Boolean(editingCategoryId),
    closeAllCatalogForms,
  );
  const editProfileLayerRef = useDismissableLayer(
    Boolean(editingProfileId),
    closeAllCatalogForms,
  );
  const editProductLayerRef = useDismissableLayer(
    Boolean(editingProductCode),
    closeAllCatalogForms,
  );
  const createProductLayerRef = useDismissableLayer(
    isCreateProductOpen,
    closeAllCatalogForms,
  );
  const quickAdjustLayerRef = useDismissableLayer(
    isQuickAdjustOpen,
    closeAllCatalogForms,
  );
  const inventoryAdjustLayerRef = useDismissableLayer(
    Boolean(editingInventoryProductCode),
    closeInventoryAdjustRow,
  );
  const createBranchLayerRef = useDismissableLayer(
    isCreateBranchOpen,
    closeAllCatalogForms,
  );

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

  const effectiveNewProductCategoryId = useMemo(() => {
    if (!newProductCategoryId) return "";
    return categories.some((c) => c.id === newProductCategoryId)
      ? newProductCategoryId
      : "";
  }, [categories, newProductCategoryId]);

  const effectiveStockCategoryId = useMemo(() => {
    if (!stockCategoryId) return "";
    return categories.some((c) => c.id === stockCategoryId)
      ? stockCategoryId
      : "";
  }, [categories, stockCategoryId]);

  const productsWithDetails = useMemo(() => {
    return products.map((p) => {
      const cat = getCategoryById(categories, p.categoryId);
      const profileId = cat
        ? guessProfileIdFromCategory(cat, sizeProfiles)
        : "";
      const profile = profileId
        ? getProfileById(sizeProfiles, profileId)
        : null;
      const price =
        cat && Number.isFinite(Number(cat.price)) ? Number(cat.price) : null;
      return {
        ...p,
        genero: profile?.genero || "",
        categoryName: cat?.name || "—",
        price,
        displayName: p?.talla ? `Talla ${p.talla}` : "—",
        stock: stockByProductCode?.[p.code] ?? 0,
      };
    });
  }, [products, categories, sizeProfiles, stockByProductCode]);

  const productsForInventory = useMemo(() => {
    const categoryNameById = {};
    for (const c of categories || []) {
      const id = String(c?.id || "").trim();
      if (!id) continue;
      categoryNameById[id] = String(c?.name || "").trim();
    }

    const tallaOrderByCategoryId = {};
    for (const c of categories || []) {
      const id = String(c?.id || "").trim();
      if (!id) continue;
      const profileId = guessProfileIdFromCategory(c, sizeProfiles);
      const profile = getProfileById(sizeProfiles, profileId);
      const tallas = getProfileTallas(profile);
      const map = {};
      for (let i = 0; i < tallas.length; i += 1) {
        const t = String(tallas[i] || "").trim();
        if (!t) continue;
        map[t] = i;
      }
      tallaOrderByCategoryId[id] = map;
    }

    const collator = new Intl.Collator("es", { sensitivity: "base" });
    return [...productsWithDetails].sort((a, b) => {
      const categoryA =
        categoryNameById[String(a?.categoryId || "").trim()] ||
        String(a?.categoryName || "").trim() ||
        "—";
      const categoryB =
        categoryNameById[String(b?.categoryId || "").trim()] ||
        String(b?.categoryName || "").trim() ||
        "—";
      const categoryCmp = collator.compare(categoryA, categoryB);
      if (categoryCmp) return categoryCmp;

      const tallaA = String(a?.talla || "").trim();
      const tallaB = String(b?.talla || "").trim();
      const map =
        tallaOrderByCategoryId[String(a?.categoryId || "").trim()] || {};
      const rankA = Object.prototype.hasOwnProperty.call(map, tallaA)
        ? map[tallaA]
        : null;
      const rankB = Object.prototype.hasOwnProperty.call(map, tallaB)
        ? map[tallaB]
        : null;
      if (rankA !== null && rankB !== null) return rankA - rankB;
      if (rankA !== null) return -1;
      if (rankB !== null) return 1;

      const aIsNumeric = isNumericSizeValue(tallaA);
      const bIsNumeric = isNumericSizeValue(tallaB);
      if (aIsNumeric && bIsNumeric) {
        const na = Number(tallaA);
        const nb = Number(tallaB);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb)
          return na - nb;
      }
      if (aIsNumeric && !bIsNumeric) return -1;
      if (!aIsNumeric && bIsNumeric) return 1;

      const tallaCmp = collator.compare(tallaA, tallaB);
      if (tallaCmp) return tallaCmp;

      return collator.compare(String(a?.code || ""), String(b?.code || ""));
    });
  }, [productsWithDetails, categories, sizeProfiles]);

  const productHasStock = useMemo(() => {
    const out = {};
    const src = stockByProductCode || {};
    for (const code of Object.keys(src)) {
      const qty = Number(src[code] ?? 0);
      if (Number.isFinite(qty) && qty > 0) out[String(code)] = true;
    }
    return out;
  }, [stockByProductCode]);

  const categoryHasStock = useMemo(() => {
    const out = {};
    for (const p of productsWithDetails) {
      const qty = Number(p?.stock ?? 0);
      if (Number.isFinite(qty) && qty > 0) out[p.categoryId] = true;
    }
    return out;
  }, [productsWithDetails]);

  const productsForStockSelection = useMemo(() => {
    return productsForInventory.filter((p) =>
      effectiveStockCategoryId
        ? p.categoryId === effectiveStockCategoryId
        : true,
    );
  }, [productsForInventory, effectiveStockCategoryId]);

  function normalizeCategoriesFromApi(rawCategories, fallbackProfileId) {
    return (rawCategories || []).map((c) => {
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
      const profileId =
        String(c?.sizeProfileId || "").trim() ||
        String(fallbackProfileId || "");
      return {
        id: c.id,
        name: c.name,
        price: safeNormalPrice,
        creditPrice: safeCreditPrice,
        wholesalePrice: safeWholesalePrice,
        sizeProfileId: profileId,
      };
    });
  }

  async function refreshCategoriesFromApi(fallbackProfileId) {
    const r = await apiGet("/api/catalog/categories");
    const fallback =
      String(fallbackProfileId || "").trim() ||
      getDefaultProfileId(sizeProfiles) ||
      getDefaultProfileId(persistedProfiles);
    const next = normalizeCategoriesFromApi(r?.categories || [], fallback);
    setCategories(next);
    return next;
  }

  async function refreshSizeProfilesFromApi() {
    const profilesRes = await apiGet("/api/size-profiles");
    const apiProfiles = Array.isArray(profilesRes?.profiles)
      ? profilesRes.profiles
      : [];
    const normalized = apiProfiles.map((p) => ({
      ...p,
      values: getProfileTallas(p),
    }));
    setSizeProfiles(normalized);
    return normalized;
  }

  async function refreshBranchesFromApi() {
    const r = await apiGet("/api/branches");
    const next = Array.isArray(r?.branches) ? r.branches : [];
    setBranches(next);
    return next;
  }

  async function refreshStockFromApi(branchId) {
    const id = String(branchId || "").trim();
    const r = await apiGet(
      `/api/inventory/stock?branchId=${encodeURIComponent(id)}`,
    );
    const next =
      r?.stockByProductCode && !Array.isArray(r.stockByProductCode)
        ? r.stockByProductCode
        : {};
    setStockByProductCode(next);
    return next;
  }

  useEffect(() => {
    if (dataSource !== "api") return;
    void refreshStockFromApi(effectiveBranchId);
  }, [dataSource, effectiveBranchId]);

  const effectiveStockProductCode = useMemo(() => {
    return productsForStockSelection.some((p) => p.code === stockProductCode)
      ? stockProductCode
      : "";
  }, [productsForStockSelection, stockProductCode]);

  const selectedCategoryForProduct = useMemo(() => {
    return getCategoryById(categories, effectiveNewProductCategoryId);
  }, [categories, effectiveNewProductCategoryId]);

  const availableTallasForProduct = useMemo(() => {
    const c = selectedCategoryForProduct;
    if (!c) return [];
    const profileId = guessProfileIdFromCategory(c, sizeProfiles);
    const profile = getProfileById(sizeProfiles, profileId);
    const t = getProfileTallas(profile);
    if (t.length) return t;
    return [];
  }, [selectedCategoryForProduct, sizeProfiles]);

  const effectiveNewProductTalla = useMemo(() => {
    if (!newProductTalla) return "";
    return availableTallasForProduct.includes(newProductTalla)
      ? newProductTalla
      : "";
  }, [availableTallasForProduct, newProductTalla]);

  const effectiveEditProductCategoryId = useMemo(() => {
    if (!editProductCategoryId) return "";
    return categories.some((c) => c.id === editProductCategoryId)
      ? editProductCategoryId
      : "";
  }, [categories, editProductCategoryId]);

  const availableTallasForEditProduct = useMemo(() => {
    const c = getCategoryById(categories, effectiveEditProductCategoryId);
    if (!c) return [];
    const profileId = guessProfileIdFromCategory(c, sizeProfiles);
    const profile = getProfileById(sizeProfiles, profileId);
    const t = getProfileTallas(profile);
    if (t.length) return t;
    return [];
  }, [categories, effectiveEditProductCategoryId, sizeProfiles]);

  const effectiveEditProductTalla = useMemo(() => {
    if (!editProductTalla) return "";
    return availableTallasForEditProduct.includes(editProductTalla)
      ? editProductTalla
      : "";
  }, [availableTallasForEditProduct, editProductTalla]);

  async function createBranch() {
    if (dataSource !== "api") return;
    const name = String(newBranchName || "").trim();
    if (!name) return;

    try {
      const r = await apiSend("/api/branches", "POST", { name });
      const createdId = String(r?.branch?.id || "").trim();
      await refreshBranchesFromApi();
      if (createdId) setSelectedBranchId(createdId);
      setIsCreateBranchOpen(false);
      setNewBranchName("");
      await refreshStockFromApi(createdId);
    } catch (e) {
      window.alert(String(e?.message || e));
    }
  }

  async function addCategory() {
    const name = String(newCategoryName || "").trim();
    const baseId = toCategoryId(name);
    const id = nextAvailableCategoryId(baseId, categories);
    const price = Number(newCategoryPrice || 0);
    const creditPrice = Number(newCategoryCreditPrice || price || 0);
    const wholesalePrice = Number(newCategoryWholesalePrice || 0);
    const profile =
      sizeProfiles.find((p) => p.id === newCategorySizeProfile) || null;

    if (!baseId || !name) return;
    if (!Number.isFinite(price) || price < 0) return;
    if (!Number.isFinite(creditPrice) || creditPrice < 0) return;
    if (!profile) {
      window.alert("Selecciona un perfil de tallas");
      return;
    }

    const safeCreditPrice =
      Number.isFinite(creditPrice) && creditPrice >= 0 ? creditPrice : price;
    const safeWholesalePrice =
      Number.isFinite(wholesalePrice) && wholesalePrice >= 0
        ? wholesalePrice
        : price;

    const nextCategory = {
      id,
      name,
      price,
      creditPrice: safeCreditPrice,
      wholesalePrice: safeWholesalePrice,
      sizeProfileId: profile.id,
    };

    if (dataSource === "api") {
      try {
        const r = await apiSend(
          "/api/catalog/categories",
          "POST",
          nextCategory,
        );
        void r;
        await refreshCategoriesFromApi(profile.id);
      } catch (e) {
        window.alert(String(e?.message || e));
        return;
      }
    } else {
      setCategories((prev) => [...prev, nextCategory]);
    }
    setNewCategoryName("");
    setNewCategoryPrice("");
    setNewCategoryCreditPrice("");
    setNewCategoryWholesalePrice("");
    setNewCategorySizeProfile("");
    setNewProductCategoryId(id);
  }

  async function addProduct() {
    if (!effectiveNewProductCategoryId) return;
    if (!effectiveNewProductTalla) {
      window.alert("Selecciona una talla");
      return;
    }
    if (
      products.some(
        (p) =>
          String(p?.categoryId || "").trim() ===
            String(effectiveNewProductCategoryId || "").trim() &&
          String(p?.talla || "").trim() ===
            String(effectiveNewProductTalla || "").trim(),
      )
    ) {
      window.alert("Ya existe un producto con esa categoría y talla");
      return;
    }

    let code = "";
    let max = 1000;
    for (const p of products) {
      const n = Number.parseInt(String(p.code), 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    code = String(max + 1);
    while (products.some((p) => String(p.code) === code)) {
      max += 1;
      code = String(max + 1);
    }

    const product = {
      code,
      categoryId: effectiveNewProductCategoryId,
      talla: effectiveNewProductTalla,
    };
    if (dataSource === "api") {
      try {
        const r = await apiSend("/api/catalog/products", "POST", product);
        const saved = r?.product || product;
        setProducts((prev) => [...prev, saved]);
        setStockByProductCode((prev) => ({
          ...prev,
          [saved.code]: prev?.[saved.code] ?? 0,
        }));
      } catch (e) {
        const message = String(e?.message || e);
        if (message.includes("409") || message.includes("duplicate_variant")) {
          window.alert("Ya existe un producto con esa categoría y talla");
        } else {
          window.alert(message);
        }
      }
      return;
    }
    setProducts((prev) => [...prev, product]);
    setStockByProductCode((prev) => ({ ...prev, [code]: prev?.[code] ?? 0 }));
  }

  async function generateProductsForAllCategories() {
    if (!categories.length) {
      window.alert("No hay categorías");
      return;
    }
    if (!sizeProfiles.length) {
      window.alert("No hay perfiles de tallas");
      return;
    }

    const existingByCategory = {};
    for (const p of products) {
      const categoryId = String(p?.categoryId || "").trim();
      const talla = String(p?.talla || "").trim();
      if (!categoryId || !talla) continue;
      if (!existingByCategory[categoryId])
        existingByCategory[categoryId] = new Set();
      existingByCategory[categoryId].add(talla);
    }

    const pending = [];
    for (const c of categories) {
      const profileId = guessProfileIdFromCategory(c, sizeProfiles);
      const profile = getProfileById(sizeProfiles, profileId);
      const tallas = getProfileTallas(profile);
      if (!tallas.length) continue;
      const existing = existingByCategory[String(c.id)] || new Set();
      for (const t of tallas) {
        const talla = String(t || "").trim();
        if (!talla) continue;
        if (existing.has(talla)) continue;
        pending.push({ categoryId: String(c.id), talla });
      }
    }

    if (!pending.length) {
      window.alert(
        "Ya existen productos para todas las tallas en todas las categorías",
      );
      return;
    }

    const preview = pending
      .slice(0, 12)
      .map((p) => `${p.categoryId}:${p.talla}`)
      .join(", ");
    const more = pending.length > 12 ? "…" : "";
    const ok = window.confirm(
      `Se crearán ${pending.length} productos (tallas faltantes) en todas las categorías.\n${preview}${more}\n\nEsto no modifica ni elimina productos existentes. ¿Continuar?`,
    );
    if (!ok) return;

    let max = 1000;
    const usedCodes = new Set(products.map((p) => String(p.code)));
    for (const p of products) {
      const n = Number.parseInt(String(p.code), 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }

    const nextCode = () => {
      let n = max + 1;
      while (usedCodes.has(String(n))) n += 1;
      max = n;
      const code = String(n);
      usedCodes.add(code);
      return code;
    };

    const created = [];
    for (const item of pending) {
      const product = {
        code: nextCode(),
        categoryId: item.categoryId,
        talla: item.talla,
      };
      if (dataSource === "api") {
        try {
          const r = await apiSend("/api/catalog/products", "POST", product);
          const saved = r?.product || product;
          created.push(saved);
        } catch (e) {
          window.alert(
            `No se pudieron generar todos los productos.\nCreados: ${created.length}\nError: ${String(e?.message || e)}`,
          );
          break;
        }
      } else {
        created.push(product);
      }
    }

    if (!created.length) return;
    setProducts((prev) => [...prev, ...created]);
    setStockByProductCode((prev) => {
      const next = { ...(prev || {}) };
      for (const p of created) next[p.code] = next?.[p.code] ?? 0;
      return next;
    });
  }

  function beginEditCategory(category) {
    closeAllCatalogForms();
    setSelectedCatalogCategoryId(category.id);
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryPrice(String(category.price ?? 0));
    setEditCategoryCreditPrice(
      String(category.creditPrice ?? category.price ?? 0),
    );
    setEditCategoryWholesalePrice(
      String(category.wholesalePrice ?? category.price ?? 0),
    );
    setEditCategoryProfileId(
      guessProfileIdFromCategory(category, sizeProfiles),
    );
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
  }

  async function saveEditCategory() {
    const name = String(editCategoryName || "").trim();
    const price = Number(editCategoryPrice || 0);
    const creditPrice = Number(editCategoryCreditPrice || price || 0);
    const wholesalePrice = Number(editCategoryWholesalePrice || 0);
    const locked = Boolean(categoryHasStock?.[editingCategoryId]);
    const lockedProfileId = locked
      ? String(
          getCategoryById(categories, editingCategoryId)?.sizeProfileId || "",
        ).trim()
      : String(editCategoryProfileId || "").trim();
    const profile = sizeProfiles.find((p) => p.id === lockedProfileId) || null;

    if (!editingCategoryId) return;
    if (!name) return;
    if (!Number.isFinite(price) || price < 0) return;
    if (!Number.isFinite(creditPrice) || creditPrice < 0) return;
    if (!profile) {
      window.alert("Selecciona un perfil de tallas");
      return;
    }

    const safeCreditPrice =
      Number.isFinite(creditPrice) && creditPrice >= 0 ? creditPrice : price;
    const safeWholesalePrice =
      Number.isFinite(wholesalePrice) && wholesalePrice >= 0
        ? wholesalePrice
        : price;

    const nextPatch = {
      name,
      price,
      creditPrice: safeCreditPrice,
      wholesalePrice: safeWholesalePrice,
      sizeProfileId: profile.id,
    };

    if (dataSource === "api") {
      try {
        await apiSend(
          `/api/catalog/categories/${encodeURIComponent(editingCategoryId)}`,
          "PATCH",
          nextPatch,
        );
        await refreshCategoriesFromApi(profile.id);
      } catch (e) {
        window.alert(String(e?.message || e));
        return;
      }
    } else {
      setCategories((prev) =>
        prev.map((c) => {
          if (c.id !== editingCategoryId) return c;
          return {
            ...c,
            name,
            price,
            creditPrice: safeCreditPrice,
            wholesalePrice: safeWholesalePrice,
            sizeProfileId: profile.id,
            tallas: c.tallas,
            tallasByGenero: c.tallasByGenero,
          };
        }),
      );
    }

    setEditingCategoryId(null);
  }

  async function deleteCategory(categoryId) {
    if (categoryHasStock?.[categoryId]) {
      window.alert("No puedes eliminar esta categoría porque tiene stock.");
      return;
    }
    const category = getCategoryById(categories, categoryId);
    const name = category?.name ? `"${category.name}"` : "esta categoría";
    const ok = window.confirm(
      `¿Seguro que quieres eliminar ${name}? También se quitarán sus productos.`,
    );
    if (!ok) return;
    let nextCategories = categories.filter((c) => c.id !== categoryId);
    let fallbackCategoryId = nextCategories[0]?.id || "";
    if (dataSource === "api") {
      try {
        await apiSend(
          `/api/catalog/categories/${encodeURIComponent(categoryId)}`,
          "DELETE",
        );
        nextCategories = await refreshCategoriesFromApi();
        fallbackCategoryId = nextCategories[0]?.id || "";
      } catch (e) {
        window.alert(String(e?.message || e));
        return;
      }
    } else {
      setCategories(nextCategories);
    }
    const removedCodes = products
      .filter((p) => p.categoryId === categoryId)
      .map((p) => p.code);

    setProducts((prev) => prev.filter((p) => p.categoryId !== categoryId));
    setStockByProductCode((prev) => {
      const next = { ...(prev || {}) };
      for (const code of removedCodes) delete next[code];
      return next;
    });

    setSelectedCatalogCategoryId((prev) => (prev === categoryId ? null : prev));
    if (editingCategoryId === categoryId) setEditingCategoryId(null);
    if (newProductCategoryId === categoryId)
      setNewProductCategoryId(fallbackCategoryId);
    if (stockCategoryId === categoryId) setStockCategoryId(fallbackCategoryId);
  }

  function beginEditProduct(product) {
    closeAllCatalogForms();
    setSelectedProductCode(String(product?.code || "").trim() || null);
    setEditingProductCode(String(product?.code || "").trim() || null);
    setEditProductCategoryId(String(product?.categoryId || "").trim());
    setEditProductTalla(String(product?.talla || "").trim());
  }

  function cancelEditProduct() {
    setEditingProductCode(null);
  }

  async function saveEditProduct() {
    const code = String(editingProductCode || "").trim();
    if (!code) return;
    if (productHasStock?.[code]) {
      window.alert("No puedes editar este producto porque tiene stock.");
      return;
    }

    const categoryId = String(effectiveEditProductCategoryId || "").trim();
    const talla = String(effectiveEditProductTalla || "").trim();
    if (!categoryId) {
      window.alert("Selecciona una categoría");
      return;
    }
    if (!talla) {
      window.alert("Selecciona una talla");
      return;
    }
    if (
      products.some(
        (p) =>
          String(p?.code || "").trim() !== code &&
          String(p?.categoryId || "").trim() === categoryId &&
          String(p?.talla || "").trim() === talla,
      )
    ) {
      window.alert("Ya existe un producto con esa categoría y talla");
      return;
    }

    if (dataSource === "api") {
      try {
        const r = await apiSend(
          `/api/catalog/products/${encodeURIComponent(code)}?branchId=${encodeURIComponent(effectiveBranchId)}`,
          "PATCH",
          { categoryId, talla },
        );
        const saved = r?.product || { code, categoryId, talla };
        setProducts((prev) =>
          prev.map((p) =>
            String(p?.code || "").trim() === code
              ? { ...p, categoryId: saved.categoryId, talla: saved.talla }
              : p,
          ),
        );
      } catch (e) {
        const message = String(e?.message || e);
        if (message.includes("409") || message.includes("duplicate_variant")) {
          window.alert("Ya existe un producto con esa categoría y talla");
        } else if (message.includes("has_stock")) {
          window.alert("No puedes editar este producto porque tiene stock.");
        } else {
          window.alert(message);
        }
        return;
      }
      setEditingProductCode(null);
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        String(p?.code || "").trim() === code ? { ...p, categoryId, talla } : p,
      ),
    );
    setEditingProductCode(null);
  }

  async function deleteProduct(productCode) {
    const code = String(productCode || "").trim();
    if (!code) return;
    if (productHasStock?.[code]) {
      window.alert("No puedes eliminar este producto porque tiene stock.");
      return;
    }

    const product = productsWithDetails.find((p) => String(p.code) === code);
    const name = product?.categoryName
      ? `"${product.categoryName}"`
      : "esta categoría";
    const talla = product?.talla ? `"${product.talla}"` : "—";
    const ok = window.confirm(
      `¿Seguro que quieres eliminar el producto ${code}?\nCategoría: ${name}\nTalla: ${talla}`,
    );
    if (!ok) return;

    if (dataSource === "api") {
      try {
        await apiSend(
          `/api/catalog/products/${encodeURIComponent(code)}?branchId=${encodeURIComponent(effectiveBranchId)}`,
          "DELETE",
        );
      } catch (e) {
        const message = String(e?.message || e);
        if (message.includes("has_stock") || message.includes("409")) {
          window.alert("No puedes eliminar este producto porque tiene stock.");
        } else {
          window.alert(message);
        }
        return;
      }
    }

    setProducts((prev) =>
      prev.filter((p) => String(p?.code || "").trim() !== code),
    );
    setStockByProductCode((prev) => {
      const next = { ...(prev || {}) };
      delete next[code];
      return next;
    });
    setSelectedProductCode((prev) => (prev === code ? null : prev));
    setEditingProductCode((prev) => (prev === code ? null : prev));
  }

  function nextAvailableProfileId(baseId) {
    if (!sizeProfiles.some((p) => p.id === baseId)) return baseId;
    let i = 2;
    while (sizeProfiles.some((p) => p.id === `${baseId}_${i}`)) i += 1;
    return `${baseId}_${i}`;
  }

  async function addSizeProfile() {
    const label = String(newSizeProfileLabel || "").trim();
    const baseId = toCategoryId(label);
    if (!label || !baseId) return;
    const id = nextAvailableProfileId(baseId);
    if (!fixedGeneros.includes(newSizeProfileGenero)) {
      window.alert("Selecciona un género");
      return;
    }
    const genero = newSizeProfileGenero;
    if (dataSource === "api") {
      try {
        const r = await apiSend("/api/size-profiles", "POST", {
          id,
          label,
          genero,
          values: [],
        });
        void r;
        await refreshSizeProfilesFromApi();
      } catch (e) {
        window.alert(String(e?.message || e));
        return;
      }
    } else {
      setSizeProfiles((prev) => [...prev, { id, label, genero, values: [] }]);
    }
    setNewSizeProfileLabel("");
    setNewSizeProfileGenero("");
  }

  function setSizeProfileLabel(profileId, nextLabel) {
    const label = String(nextLabel || "").trimStart();
    setSizeProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, label } : p)),
    );
  }

  function setSizeProfileGenero(profileId, genero) {
    const g = fixedGeneros.includes(genero) ? genero : "";
    setSizeProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, genero: g } : p)),
    );
  }

  async function saveSizeProfile(profileId) {
    if (dataSource !== "api") return;
    const profile = sizeProfiles.find((p) => p.id === profileId) || null;
    if (!profile) return;
    try {
      await apiSend(
        `/api/size-profiles/${encodeURIComponent(profileId)}`,
        "PATCH",
        {
          label: profile.label,
          genero: profile.genero,
          values: getProfileTallas(profile),
        },
      );
      await refreshSizeProfilesFromApi();
    } catch (e) {
      window.alert(String(e?.message || e));
    }
  }

  async function addSizeProfileValue(profileId) {
    const raw = profileValueDraft?.[profileId];
    const value = String(raw || "").trim();
    if (!value) return;
    let nextValues = null;
    setSizeProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        const base = Array.isArray(p.values) ? p.values : [];
        if (base.includes(value)) {
          nextValues = base;
          return p;
        }
        nextValues = [...base, value];
        return { ...p, values: nextValues };
      }),
    );
    if (dataSource === "api" && Array.isArray(nextValues)) {
      try {
        await apiSend(
          `/api/size-profiles/${encodeURIComponent(profileId)}`,
          "PATCH",
          {
            values: nextValues,
          },
        );
      } catch (e) {
        window.alert(String(e?.message || e));
      }
    }
    setProfileValueDraft((prev) => ({ ...prev, [profileId]: "" }));
  }

  async function removeSizeProfileValue(profileId, value) {
    const ok = window.confirm(
      `¿Seguro que quieres quitar la talla "${value}"?`,
    );
    if (!ok) return;
    let nextValues = null;
    setSizeProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        const base = Array.isArray(p.values) ? p.values : [];
        nextValues = base.filter((v) => v !== value);
        return { ...p, values: nextValues };
      }),
    );
    if (dataSource === "api" && Array.isArray(nextValues)) {
      try {
        await apiSend(
          `/api/size-profiles/${encodeURIComponent(profileId)}`,
          "PATCH",
          {
            values: nextValues,
          },
        );
      } catch (e) {
        window.alert(String(e?.message || e));
      }
    }
  }

  async function setSizeProfileValues(profileId, values) {
    const nextValues = uniqueOrdered(values);
    setSizeProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, values: nextValues } : p)),
    );
    if (dataSource === "api") {
      try {
        await apiSend(
          `/api/size-profiles/${encodeURIComponent(profileId)}`,
          "PATCH",
          { values: nextValues },
        );
      } catch (e) {
        window.alert(String(e?.message || e));
      }
    }
  }

  async function renameSizeProfileValue(profileId, fromValue, toValue) {
    const from = String(fromValue || "").trim();
    const to = String(toValue || "").trim();
    if (!from || !to) return;
    if (from === to) return;

    const affectedCategoryIds = new Set(
      (categories || [])
        .filter((c) => String(c?.sizeProfileId || "").trim() === profileId)
        .map((c) => String(c?.id || "").trim())
        .filter(Boolean),
    );

    let nextValues = null;
    setSizeProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        const base = Array.isArray(p.values) ? p.values : [];
        const renamed = base.map((v) => (String(v) === from ? to : v));
        nextValues = uniqueOrdered(renamed);
        return { ...p, values: nextValues };
      }),
    );

    if (affectedCategoryIds.size) {
      setProducts((prev) =>
        prev.map((p) => {
          const categoryId = String(p?.categoryId || "").trim();
          const talla = String(p?.talla || "").trim();
          if (!affectedCategoryIds.has(categoryId)) return p;
          if (talla !== from) return p;
          return { ...p, talla: to };
        }),
      );
    }

    setNewProductTalla((prev) =>
      String(prev || "").trim() === from ? to : prev,
    );
    setEditProductTalla((prev) =>
      String(prev || "").trim() === from ? to : prev,
    );

    if (dataSource === "api") {
      try {
        await apiSend(
          `/api/size-profiles/${encodeURIComponent(profileId)}/rename-value`,
          "POST",
          { from, to },
        );
        await refreshSizeProfilesFromApi();
      } catch (e) {
        window.alert(String(e?.message || e));
        await refreshSizeProfilesFromApi();
      }
    } else {
      if (Array.isArray(nextValues)) {
        setSizeProfiles((prev) =>
          prev.map((p) =>
            p.id === profileId ? { ...p, values: nextValues } : p,
          ),
        );
      }
    }
  }

  async function deleteSizeProfile(profileId) {
    const profile = sizeProfiles.find((p) => p.id === profileId) || null;
    const nextProfiles = sizeProfiles.filter((p) => p.id !== profileId);
    if (!nextProfiles.length) return;
    const fallbackId = getDefaultProfileId(nextProfiles);
    const name = profile?.label ? `"${profile.label}"` : "este perfil";
    const ok = window.confirm(
      `¿Seguro que quieres eliminar ${name}? Las categorías que lo usan se moverán a "${fallbackId}".`,
    );
    if (!ok) return;

    if (dataSource === "api") {
      try {
        await apiSend(
          `/api/size-profiles/${encodeURIComponent(profileId)}`,
          "DELETE",
          {
            fallbackId,
          },
        );
        await refreshSizeProfilesFromApi();
        await refreshCategoriesFromApi(fallbackId);
      } catch (e) {
        window.alert(String(e?.message || e));
        return;
      }
      setSelectedProfileId((prev) => (prev === profileId ? null : prev));
      setEditingProfileId((prev) => (prev === profileId ? null : prev));
      if (newCategorySizeProfile === profileId)
        setNewCategorySizeProfile(fallbackId);
      if (editCategoryProfileId === profileId)
        setEditCategoryProfileId(fallbackId);
      return;
    }

    setSizeProfiles(nextProfiles);
    setSelectedProfileId((prev) => (prev === profileId ? null : prev));
    setEditingProfileId((prev) => (prev === profileId ? null : prev));
    setCategories((prev) =>
      prev.map((c) => {
        if (c.sizeProfileId !== profileId) return c;
        return { ...c, sizeProfileId: fallbackId };
      }),
    );
    if (newCategorySizeProfile === profileId)
      setNewCategorySizeProfile(fallbackId);
    if (editCategoryProfileId === profileId)
      setEditCategoryProfileId(fallbackId);
  }

  function beginInventoryAdjustRow(product) {
    const code = String(product?.code || "").trim();
    if (!code) return;
    closeAllCatalogForms();
    setEditingInventoryProductCode(code);
    const current = Number(stockByProductCode?.[code] ?? 0);
    const safeCurrent =
      Number.isFinite(current) && current >= 0 ? Math.floor(current) : 0;
    setInventoryStockDraft(String(safeCurrent));
  }

  function bumpInventoryDraft(delta) {
    const n = Number.parseInt(String(inventoryStockDraft || 0), 10);
    const base = Number.isFinite(n) && n >= 0 ? n : 0;
    const next = Math.max(0, base + delta);
    setInventoryStockDraft(String(next));
  }

  async function saveInventoryAdjustRow() {
    const code = String(editingInventoryProductCode || "").trim();
    if (!code) return;

    const desired = Number.parseInt(String(inventoryStockDraft || 0), 10);
    if (!Number.isFinite(desired) || desired < 0) {
      window.alert("Stock inválido");
      return;
    }

    const currentRaw = Number(stockByProductCode?.[code] ?? 0);
    const current =
      Number.isFinite(currentRaw) && currentRaw >= 0 ? currentRaw : 0;
    const delta = desired - current;
    if (!delta) {
      closeInventoryAdjustRow();
      return;
    }

    if (delta < 0) {
      const ok = window.confirm(
        `¿Seguro que quieres quitar ${Math.abs(delta)} de stock?`,
      );
      if (!ok) return;
    }

    if (dataSource === "api") {
      try {
        const r = await apiSend(
          `/api/inventory/adjust?branchId=${encodeURIComponent(effectiveBranchId)}`,
          "POST",
          {
            code,
            delta,
            reason: "admin_row_adjust",
          },
        );
        const nextQty = Number(r?.qty ?? desired);
        setStockByProductCode((prev) => ({ ...(prev || {}), [code]: nextQty }));
        closeInventoryAdjustRow();
      } catch (e) {
        window.alert(String(e?.message || e));
      }
      return;
    }

    setStockByProductCode((prev) => {
      const prevQty = Number(prev?.[code] ?? 0);
      const safePrev = Number.isFinite(prevQty) && prevQty >= 0 ? prevQty : 0;
      return { ...(prev || {}), [code]: Math.max(0, safePrev + delta) };
    });
    closeInventoryAdjustRow();
  }

  async function adjustStock(delta) {
    const code = effectiveStockProductCode;
    const n = Number(stockDelta || 0);
    if (!code) return;
    if (!Number.isFinite(n) || n <= 0) return;
    const d = delta * n;
    if (d < 0) {
      const ok = window.confirm(
        `¿Seguro que quieres quitar ${Math.abs(d)} de stock?`,
      );
      if (!ok) return;
    }
    if (dataSource === "api") {
      try {
        const r = await apiSend(
          `/api/inventory/adjust?branchId=${encodeURIComponent(effectiveBranchId)}`,
          "POST",
          {
            code,
            delta: d,
            reason: "admin_adjust",
          },
        );
        const nextQty = Number(r?.qty ?? 0);
        setStockByProductCode((prev) => ({ ...(prev || {}), [code]: nextQty }));
      } catch (e) {
        window.alert(String(e?.message || e));
      }
      return;
    }
    setStockByProductCode((prev) => {
      const current = prev?.[code] ?? 0;
      return { ...(prev || {}), [code]: Math.max(0, current + d) };
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Tienda Admin</h1>

      <div className="flex flex-wrap gap-3 print:hidden">
        <TabButton
          active={tab === "catalogos"}
          onClick={() => setTab("catalogos")}
        >
          Catálogos
        </TabButton>
        <TabButton
          active={tab === "productos"}
          onClick={() => setTab("productos")}
        >
          Productos
        </TabButton>
        <TabButton
          active={tab === "inventario"}
          onClick={() => setTab("inventario")}
        >
          Inventario
        </TabButton>
      </div>

      {tab === "catalogos" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div ref={createCategoryLayerRef}>
              <Panel
                title="Crear categoría"
                subtitle="Todos los productos en la categoría cuestan lo mismo."
                className="bg-indigo-50 ring-indigo-200"
                actions={
                  isCreateCategoryOpen ? (
                    <XButton onClick={closeAllCatalogForms} />
                  ) : null
                }
              >
                {!isCreateCategoryOpen ? (
                  <BigButton
                    className="w-full bg-indigo-600 text-white"
                    onClick={openCreateCategory}
                  >
                    Crear categoría
                  </BigButton>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Nombre categoría"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Ej. Pantalones Premium"
                    />
                    <Field
                      label="Precio normal"
                      value={newCategoryPrice}
                      onChange={(e) => setNewCategoryPrice(e.target.value)}
                      placeholder="Ej. 450"
                      inputMode="numeric"
                    />
                    <Field
                      label="Precio a crédito"
                      value={newCategoryCreditPrice}
                      onChange={(e) =>
                        setNewCategoryCreditPrice(e.target.value)
                      }
                      placeholder="Ej. 480"
                      inputMode="numeric"
                    />
                    <Field
                      label="Precio mayoreo"
                      value={newCategoryWholesalePrice}
                      onChange={(e) =>
                        setNewCategoryWholesalePrice(e.target.value)
                      }
                      placeholder="Ej. 350"
                      inputMode="numeric"
                    />
                    <SelectField
                      label="Perfil de tallas"
                      value={newCategorySizeProfile}
                      onChange={(e) =>
                        setNewCategorySizeProfile(e.target.value)
                      }
                      options={[
                        { value: "", label: "Selecciona…" },
                        ...sizeProfiles.map((p) => ({
                          value: p.id,
                          label: p.genero
                            ? `${p.label} · ${p.genero}`
                            : p.label,
                        })),
                      ]}
                      className="sm:col-span-2"
                    />
                    <div className="sm:col-span-2">
                      <BigButton className="w-full" onClick={addCategory}>
                        Crear categoría
                      </BigButton>
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            <Panel
              title="Categorías"
              subtitle="Edita nombre, precio normal, precio a crédito, precio mayoreo y perfil de tallas."
              className="bg-indigo-50 ring-indigo-200"
            >
              <div className="space-y-3">
                {categories.map((c) => {
                  const isEditing = editingCategoryId === c.id;
                  const isSelected = selectedCatalogCategoryId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (isEditing) return;
                        closeAllCatalogForms();
                        setSelectedCatalogCategoryId((prev) =>
                          prev === c.id ? null : c.id,
                        );
                      }}
                      ref={isEditing ? editCategoryLayerRef : null}
                      className={[
                        "rounded-2xl bg-white/70 p-4 ring-1 ring-indigo-200",
                        isSelected ? "ring-indigo-700" : "",
                      ].join(" ")}
                    >
                      {!isEditing ? (
                        <div className="space-y-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-base font-extrabold">
                                {c.name}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-600">
                                ${c.price} / ${c.creditPrice ?? c.price} / $
                                {c.wholesalePrice ?? c.price} ·{" "}
                                {summarizeTallasByProfile(c, sizeProfiles)}
                              </div>
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="grid grid-cols-2 gap-2">
                              <BigButton
                                className="w-full"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  beginEditCategory(c);
                                }}
                              >
                                Editar
                              </BigButton>
                              <BigButton
                                className="w-full"
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCategory(c.id);
                                }}
                              >
                                Eliminar
                              </BigButton>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div
                          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end sm:col-span-2">
                            <XButton onClick={closeAllCatalogForms} />
                          </div>
                          <Field
                            label="Nombre"
                            value={editCategoryName}
                            onChange={(e) =>
                              setEditCategoryName(e.target.value)
                            }
                            placeholder="Ej. Playeras Básicas"
                          />
                          <Field
                            label="Precio normal"
                            value={editCategoryPrice}
                            onChange={(e) =>
                              setEditCategoryPrice(e.target.value)
                            }
                            inputMode="numeric"
                            placeholder="Ej. 150"
                          />
                          <Field
                            label="Precio a crédito"
                            value={editCategoryCreditPrice}
                            onChange={(e) =>
                              setEditCategoryCreditPrice(e.target.value)
                            }
                            inputMode="numeric"
                            placeholder="Ej. 180"
                          />
                          <Field
                            label="Precio mayoreo"
                            value={editCategoryWholesalePrice}
                            onChange={(e) =>
                              setEditCategoryWholesalePrice(e.target.value)
                            }
                            inputMode="numeric"
                            placeholder="Ej. 120"
                          />
                          <SelectField
                            label="Perfil de tallas"
                            value={editCategoryProfileId}
                            onChange={(e) =>
                              setEditCategoryProfileId(e.target.value)
                            }
                            disabled={Boolean(
                              categoryHasStock?.[editingCategoryId],
                            )}
                            options={[
                              { value: "", label: "Selecciona…" },
                              ...sizeProfiles.map((p) => ({
                                value: p.id,
                                label: p.genero
                                  ? `${p.label} · ${p.genero}`
                                  : p.label,
                              })),
                            ]}
                            className="sm:col-span-2"
                          />
                          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                            <BigButton
                              className="w-full"
                              onClick={saveEditCategory}
                            >
                              Guardar
                            </BigButton>
                            <BigButton
                              className="w-full"
                              variant="secondary"
                              onClick={cancelEditCategory}
                            >
                              Cancelar
                            </BigButton>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <div ref={createSizeProfileLayerRef}>
              <Panel
                title="Crear perfil"
                subtitle="Crea un perfil de tallas."
                className="bg-emerald-50 ring-emerald-200"
                actions={
                  isCreateSizeProfileOpen ? (
                    <XButton onClick={closeAllCatalogForms} />
                  ) : null
                }
              >
                {!isCreateSizeProfileOpen ? (
                  <BigButton
                    className="w-full bg-emerald-600 text-white"
                    onClick={openCreateSizeProfile}
                  >
                    Crear perfil
                  </BigButton>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                    <div className="sm:col-span-2">
                      <Field
                        label="Nuevo perfil"
                        value={newSizeProfileLabel}
                        onChange={(e) => setNewSizeProfileLabel(e.target.value)}
                        placeholder="Ej. Pantalón dama"
                      />
                    </div>
                    <SelectField
                      label="Género"
                      value={newSizeProfileGenero}
                      onChange={(e) => setNewSizeProfileGenero(e.target.value)}
                      options={[
                        { value: "", label: "Selecciona…" },
                        ...fixedGeneros.map((g) => ({ value: g, label: g })),
                      ]}
                    />
                    <div className="sm:col-span-1">
                      <BigButton className="w-full" onClick={addSizeProfile}>
                        Crear perfil
                      </BigButton>
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            <Panel
              title="Perfiles de tallas"
              subtitle="Edita tallas como tags (ej. 25.5). Las categorías solo eligen un perfil."
              className="bg-emerald-50 ring-emerald-200"
            >
              <div className="space-y-4">
                {sizeProfiles.map((p) => {
                  const preview = `${getProfileTallas(p).slice(0, 10).join(", ")}${
                    getProfileTallas(p).length > 10 ? "…" : ""
                  }`;
                  const isSelected = selectedProfileId === p.id;
                  const isEditing = editingProfileId === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isEditing) return;
                        closeAllCatalogForms();
                        setSelectedProfileId((prev) =>
                          prev === p.id ? null : p.id,
                        );
                      }}
                      ref={isEditing ? editProfileLayerRef : null}
                      className={[
                        "rounded-2xl bg-white/70 p-4 ring-1 ring-emerald-200",
                        isSelected ? "ring-emerald-700" : "",
                      ].join(" ")}
                    >
                      {!isEditing ? (
                        <div className="space-y-3">
                          <div className="min-w-0">
                            <div className="text-base font-extrabold">
                              {p.label}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-600">
                              {p.genero ? `${p.genero} · ` : ""}
                              {preview || "—"}
                            </div>
                          </div>

                          {isSelected ? (
                            <div
                              className={[
                                "grid gap-2",
                                sizeProfiles.length > 1
                                  ? "grid-cols-2"
                                  : "grid-cols-1",
                              ].join(" ")}
                            >
                              <BigButton
                                className="w-full"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeAllCatalogForms();
                                  setEditingProfileId(p.id);
                                  setSelectedProfileId(p.id);
                                }}
                              >
                                Editar
                              </BigButton>
                              {sizeProfiles.length > 1 ? (
                                <BigButton
                                  className="w-full"
                                  variant="danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSizeProfile(p.id);
                                  }}
                                >
                                  Eliminar
                                </BigButton>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div
                          className="space-y-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            <XButton onClick={closeAllCatalogForms} />
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                            <Field
                              label="Nombre"
                              value={p.label}
                              onChange={(e) =>
                                setSizeProfileLabel(p.id, e.target.value)
                              }
                              placeholder="Ej. Calzado"
                            />
                            <SelectField
                              label="Género"
                              value={p.genero || ""}
                              onChange={(e) =>
                                setSizeProfileGenero(p.id, e.target.value)
                              }
                              options={[
                                { value: "", label: "Selecciona…" },
                                ...fixedGeneros.map((g) => ({
                                  value: g,
                                  label: g,
                                })),
                              ]}
                            />
                          </div>

                          <div
                            className={[
                              "grid gap-2",
                              sizeProfiles.length > 1
                                ? "grid-cols-2"
                                : "grid-cols-1",
                            ].join(" ")}
                          >
                            <BigButton
                              className="w-full"
                              variant="secondary"
                              onClick={async () => {
                                await saveSizeProfile(p.id);
                                setEditingProfileId(null);
                              }}
                            >
                              Listo
                            </BigButton>
                            {sizeProfiles.length > 1 ? (
                              <BigButton
                                className="w-full"
                                variant="danger"
                                onClick={() => deleteSizeProfile(p.id)}
                              >
                                Eliminar
                              </BigButton>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                            <div className="sm:col-span-2">
                              <Field
                                label="Agregar talla"
                                value={profileValueDraft?.[p.id] || ""}
                                onChange={(e) =>
                                  setProfileValueDraft((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                placeholder="Ej. XS o 25.5"
                                inputMode="text"
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <BigButton
                                className="w-full"
                                variant="secondary"
                                onClick={() => addSizeProfileValue(p.id)}
                              >
                                Agregar
                              </BigButton>
                            </div>
                          </div>

                          <div className="text-sm font-semibold text-slate-600">
                            {preview || "—"}
                          </div>

                          <ReorderableTallasList
                            profileId={p.id}
                            values={getProfileTallas(p)}
                            onCommit={setSizeProfileValues}
                            onRemove={removeSizeProfileValue}
                            onRename={renameSizeProfileValue}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "productos" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div ref={createProductLayerRef}>
            <Panel
              title="Crear producto"
              subtitle="El No. se genera automático. El precio viene de la categoría."
              actions={
                isCreateProductOpen ? (
                  <XButton onClick={closeAllCatalogForms} />
                ) : null
              }
            >
              {!isCreateProductOpen ? (
                <BigButton className="w-full" onClick={openCreateProduct}>
                  Crear producto
                </BigButton>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Categoría"
                    value={effectiveNewProductCategoryId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNewProductCategoryId(id);
                      setNewProductTalla("");
                    }}
                    options={[
                      { value: "", label: "Selecciona…" },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: `${c.name} ($${c.price} / $${c.creditPrice ?? c.price} / $${c.wholesalePrice ?? c.price})`,
                      })),
                    ]}
                  />
                  <SelectField
                    label="Talla"
                    value={effectiveNewProductTalla}
                    onChange={(e) => setNewProductTalla(e.target.value)}
                    options={[
                      { value: "", label: "Selecciona…" },
                      ...availableTallasForProduct.map((t) => ({
                        value: t,
                        label: t,
                      })),
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <BigButton className="w-full" onClick={addProduct}>
                        Crear producto
                      </BigButton>
                      <BigButton
                        className="w-full"
                        variant="secondary"
                        onClick={generateProductsForAllCategories}
                      >
                        Generar todas las tallas
                      </BigButton>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <Panel
            title="Lista de productos"
            subtitle="Persistente en este dispositivo."
            actions={
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <SelectField
                  label="Tienda"
                  value={effectiveBranchId}
                  disabled={dataSource !== "api"}
                  onChange={(e) => {
                    closeAllCatalogForms();
                    setSelectedBranchId(e.target.value);
                  }}
                  options={branchOptions}
                  className="sm:min-w-[240px]"
                />
                <BigButton
                  variant="secondary"
                  className="whitespace-nowrap"
                  disabled={dataSource !== "api"}
                  onClick={() => {
                    if (isCreateBranchOpen) {
                      closeAllCatalogForms();
                      return;
                    }
                    openCreateBranch();
                  }}
                >
                  Crear tienda
                </BigButton>
              </div>
            }
          >
            {isCreateBranchOpen ? (
              <div ref={createBranchLayerRef} className="mb-4">
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-extrabold">
                        Crear tienda
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        Se usa para manejar el inventario por tienda.
                      </div>
                    </div>
                    <XButton onClick={closeAllCatalogForms} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <Field
                      label="Nombre"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Ej. Sucursal Centro"
                    />
                    <div>
                      <BigButton className="w-full" onClick={createBranch}>
                        Guardar tienda
                      </BigButton>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
              <div className="w-full">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <div className="col-span-1">No.</div>
                  <div className="col-span-2">Género</div>
                  <div className="col-span-6">Categoría</div>
                  <div className="col-span-1">Talla</div>
                  <div className="col-span-1 text-right">Precio</div>
                  <div className="col-span-1 text-right">Stock</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {productsForInventory.map((p) => {
                    const isSelected = selectedProductCode === p.code;
                    const isEditing = editingProductCode === p.code;
                    const hasStock = Boolean(productHasStock?.[p.code]);
                    return (
                      <div
                        key={p.code}
                        ref={isEditing ? editProductLayerRef : null}
                        className={isSelected ? "bg-slate-50" : ""}
                      >
                        <div
                          onClick={() => {
                            if (isEditing) {
                              cancelEditProduct();
                              return;
                            }
                            if (isSelected) {
                              setSelectedProductCode(null);
                              return;
                            }
                            closeAllCatalogForms();
                            setSelectedProductCode(p.code);
                          }}
                          className="grid grid-cols-12 px-4 py-3 text-base font-semibold cursor-pointer"
                        >
                          <div className="col-span-1 tabular-nums">
                            {p.code}
                          </div>
                          <div className="col-span-2">{p.genero || "—"}</div>
                          <div className="col-span-6 text-slate-600">
                            {p.categoryName}
                          </div>
                          <div className="col-span-1">{p.talla || "—"}</div>
                          <div className="col-span-1 text-right tabular-nums">
                            {p.price === null ? "—" : `$${p.price}`}
                          </div>
                          <div className="col-span-1 text-right tabular-nums">
                            {p.stock}
                          </div>
                        </div>

                        {isSelected ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="px-4 pb-4"
                          >
                            {!isEditing ? (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <BigButton
                                  className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
                                  variant="secondary"
                                  disabled={hasStock}
                                  onClick={() => beginEditProduct(p)}
                                >
                                  Editar
                                </BigButton>
                                <BigButton
                                  className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
                                  variant="danger"
                                  disabled={hasStock}
                                  onClick={() => deleteProduct(p.code)}
                                >
                                  Eliminar
                                </BigButton>
                                {hasStock ? (
                                  <div className="text-sm font-semibold text-slate-600 sm:col-span-2">
                                    No se puede editar o eliminar porque tiene
                                    stock.
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <SelectField
                                  label="Categoría"
                                  value={effectiveEditProductCategoryId}
                                  disabled={hasStock}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    setEditProductCategoryId(id);
                                    setEditProductTalla("");
                                  }}
                                  options={[
                                    { value: "", label: "Selecciona…" },
                                    ...categories.map((c) => ({
                                      value: c.id,
                                      label: `${c.name} ($${c.price} / $${c.creditPrice ?? c.price} / $${c.wholesalePrice ?? c.price})`,
                                    })),
                                  ]}
                                />
                                <SelectField
                                  label="Talla"
                                  value={effectiveEditProductTalla}
                                  disabled={hasStock}
                                  onChange={(e) =>
                                    setEditProductTalla(e.target.value)
                                  }
                                  options={[
                                    { value: "", label: "Selecciona…" },
                                    ...availableTallasForEditProduct.map(
                                      (t) => ({
                                        value: t,
                                        label: t,
                                      }),
                                    ),
                                  ]}
                                />
                                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                                  <BigButton
                                    className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={
                                      hasStock ||
                                      !effectiveEditProductCategoryId ||
                                      !effectiveEditProductTalla
                                    }
                                    onClick={saveEditProduct}
                                  >
                                    Guardar
                                  </BigButton>
                                  <BigButton
                                    className="w-full"
                                    variant="secondary"
                                    onClick={cancelEditProduct}
                                  >
                                    Cancelar
                                  </BigButton>
                                </div>
                                {hasStock ? (
                                  <div className="text-sm font-semibold text-slate-600 sm:col-span-2">
                                    No se puede editar este producto porque
                                    tiene stock.
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!productsWithDetails.length ? (
                    <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                      Sin productos
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "inventario" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div ref={quickAdjustLayerRef}>
            <Panel
              title="Ajuste rápido"
              subtitle="Entradas/salidas por producto."
              actions={
                isQuickAdjustOpen ? (
                  <XButton onClick={closeAllCatalogForms} />
                ) : null
              }
            >
              {!isQuickAdjustOpen ? (
                <BigButton className="w-full" onClick={openQuickAdjust}>
                  Ajustar stock
                </BigButton>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Categoría"
                    value={effectiveStockCategoryId}
                    onChange={(e) => setStockCategoryId(e.target.value)}
                    options={[
                      { value: "", label: "Selecciona…" },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                    ]}
                  />
                  <SelectField
                    label="Producto"
                    value={effectiveStockProductCode}
                    onChange={(e) => setStockProductCode(e.target.value)}
                    options={[
                      { value: "", label: "Selecciona…" },
                      ...productsForStockSelection.map((p) => ({
                        value: p.code,
                        label: `${p.talla ? `Talla ${p.talla}` : "—"}`,
                      })),
                    ]}
                    className="sm:col-span-2"
                  />
                  <Field
                    label="Cantidad"
                    value={stockDelta}
                    onChange={(e) => setStockDelta(e.target.value)}
                    inputMode="numeric"
                    placeholder="Ej. 1"
                  />
                  <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                    <BigButton
                      className="w-full"
                      onClick={() => adjustStock(+1)}
                    >
                      + Agregar
                    </BigButton>
                    <BigButton
                      className="w-full"
                      variant="danger"
                      onClick={() => adjustStock(-1)}
                    >
                      - Quitar
                    </BigButton>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <Panel
            title="Inventario por producto"
            subtitle="No., Género, Categoría, Talla, Precio y Stock."
          >
            <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
              <div className="w-full">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <div className="col-span-1">No.</div>
                  <div className="col-span-2">Género</div>
                  <div className="col-span-6">Categoría</div>
                  <div className="col-span-1">Talla</div>
                  <div className="col-span-1 text-right">Precio</div>
                  <div className="col-span-1 text-right">Stock</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {productsForInventory.map((p) => {
                    const isEditing =
                      String(p?.code || "").trim() ===
                        String(editingInventoryProductCode || "").trim() &&
                      Boolean(editingInventoryProductCode);
                    return (
                      <div
                        key={p.code}
                        ref={isEditing ? inventoryAdjustLayerRef : null}
                        className={isEditing ? "bg-slate-50" : ""}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (isEditing) {
                              closeInventoryAdjustRow();
                              return;
                            }
                            beginInventoryAdjustRow(p);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (isEditing) {
                                closeInventoryAdjustRow();
                                return;
                              }
                              beginInventoryAdjustRow(p);
                            }
                          }}
                          className="grid grid-cols-12 px-4 py-3 text-base font-semibold cursor-pointer"
                        >
                          <div className="col-span-1 tabular-nums">
                            {p.code}
                          </div>
                          <div className="col-span-2">{p.genero || "—"}</div>
                          <div className="col-span-6 text-slate-600">
                            {p.categoryName}
                          </div>
                          <div className="col-span-1">{p.talla || "—"}</div>
                          <div className="col-span-1 text-right tabular-nums">
                            {p.price === null ? "—" : `$${p.price}`}
                          </div>
                          <div className="col-span-1 text-right tabular-nums">
                            {p.stock}
                          </div>
                        </div>

                        {isEditing ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="px-4 pb-4"
                          >
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
                                <div className="sm:col-span-3">
                                  <div className="text-sm font-extrabold text-slate-700">
                                    Stock
                                  </div>
                                  <input
                                    value={inventoryStockDraft}
                                    onChange={(e) =>
                                      setInventoryStockDraft(e.target.value)
                                    }
                                    inputMode="numeric"
                                    type="number"
                                    min="0"
                                    step="1"
                                    className={[
                                      "mt-2 h-12 w-full rounded-2xl bg-white px-4 text-base font-semibold",
                                      "ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900",
                                    ].join(" ")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void saveInventoryAdjustRow();
                                      }
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        closeInventoryAdjustRow();
                                      }
                                    }}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:col-span-3">
                                  <button
                                    type="button"
                                    onClick={() => bumpInventoryDraft(-1)}
                                    className="h-12 rounded-2xl bg-white text-base font-extrabold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                                  >
                                    −
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => bumpInventoryDraft(+1)}
                                    className="h-12 rounded-2xl bg-white text-base font-extrabold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:col-span-6">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void saveInventoryAdjustRow()
                                    }
                                    className="h-12 rounded-2xl bg-slate-900 px-4 text-sm font-extrabold text-white active:scale-[0.99]"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={closeInventoryAdjustRow}
                                    className="h-12 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200 active:scale-[0.99]"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!productsWithDetails.length ? (
                    <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                      Sin productos
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
