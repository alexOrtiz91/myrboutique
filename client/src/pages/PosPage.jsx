import { useEffect, useMemo, useRef, useState } from "react";
import BigButton from "../components/BigButton.jsx";
import ScannerCapture from "../components/ScannerCapture.jsx";
import { apiGet, apiSend } from "../api.js";
import {
  getCategoryById,
  getProductByCode,
  getProductName,
} from "../mocks/catalog.js";

const STORAGE_KEY = "myrboutique:tienda-admin:v1";
const POS_STORAGE_KEY = "myrboutique:pos-demo:v1";
const WHOLESALE_MIN_QTY = 15;
const DISCOUNT_PRESETS = [5, 10, 15, 20, 25];

function roundMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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
    void 0;
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function TicketRow({ item, onRemove, onPickMode }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold">{item.name}</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-600">
            {item.categoryName}
            {item.pricingTag ? ` · ${item.pricingTag}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-extrabold tabular-nums">
            ${item.unitPrice}
          </div>
          {item.unitPrice !== item.creditUnitPrice ? (
            <div className="mt-1 text-xs font-extrabold text-emerald-700 tabular-nums">
              -${roundMoney(Math.max(0, item.creditUnitPrice - item.unitPrice))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-12 items-center gap-2">
        <div className="col-span-8">
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "contado", label: "Contado" },
              { key: "mayoreo", label: "Mayoreo" },
            ].map((opt) => {
              const active = item.priceMode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={Boolean(item.isAutoWholesale)}
                  onClick={() => onPickMode?.(opt.key)}
                  className={
                    "h-12 rounded-2xl px-3 text-sm font-extrabold ring-1 focus:outline-none focus:ring-2 focus:ring-slate-900" +
                    (active
                      ? " bg-slate-900 text-white ring-slate-900"
                      : " bg-white text-slate-900 ring-slate-200") +
                    (item.isAutoWholesale ? " opacity-60" : "")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="h-12 w-full rounded-2xl bg-rose-600 px-4 text-sm font-extrabold text-white"
          >
            Quitar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PosPage() {
  const [persisted] = useState(() => readJson(STORAGE_KEY));
  const [persistedPos] = useState(() => readJson(POS_STORAGE_KEY));
  const nextLineIdRef = useRef(1);
  const [isPaying, setIsPaying] = useState(false);
  const [wholesaleCustomer, setWholesaleCustomer] = useState(() => {
    return Boolean(persistedPos?.wholesaleCustomer);
  });
  const [itemPriceMode, setItemPriceMode] = useState(() => {
    const base = persistedPos?.itemPriceMode;
    return isPlainObject(base) ? base : {};
  });
  const [discountChoice, setDiscountChoice] = useState(() => {
    const raw = String(persistedPos?.discountChoice || "").trim();
    const n = Number(raw);
    if (Number.isFinite(n) && DISCOUNT_PRESETS.includes(n)) return String(n);
    return "";
  });
  const [categories, setCategories] = useState(() => {
    const base =
      Array.isArray(persisted?.categories) && persisted.categories.length
        ? persisted.categories
        : [];
    return base.map((c) => {
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
  });
  const [products, setProducts] = useState(() => {
    const base =
      Array.isArray(persisted?.products) && persisted.products.length
        ? persisted.products
        : [];
    return base.map((p) => ({ ...p, name: p?.name ? String(p.name) : "" }));
  });
  const [ticket, setTicket] = useState(() => {
    const base = persistedPos?.ticket;
    if (!Array.isArray(base)) return [];
    let seq = 1;
    const now = Date.now();
    const makeId = () => `${now}_${seq++}`;
    const out = [];
    for (const raw of base) {
      const qty = Math.max(1, Math.floor(Number(raw?.qty ?? 1) || 1));
      for (let i = 0; i < qty; i += 1) {
        const lineId = String(raw?.lineId || "").trim() || makeId();
        out.push({ ...raw, qty: 1, lineId });
      }
    }
    return out;
  });
  const [message, setMessage] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);

  useEffect(() => {
    writeJson(POS_STORAGE_KEY, {
      ticket,
      discountChoice,
      wholesaleCustomer,
      itemPriceMode,
    });
  }, [ticket, discountChoice, wholesaleCustomer, itemPriceMode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiGet("/api/db/health");
        const [catRes, prodRes] = await Promise.all([
          apiGet("/api/catalog/categories"),
          apiGet("/api/catalog/products"),
        ]);
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
        const nextProducts = (prodRes?.products || []).map((p) => ({
          ...p,
          name: "",
        }));
        setCategories(nextCategories);
        setProducts(nextProducts);
      } catch {
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function newLineId() {
    const n = nextLineIdRef.current;
    nextLineIdRef.current = n + 1;
    return `${Date.now()}_${n}`;
  }

  const pieces = useMemo(() => ticket.length, [ticket]);
  const wholesaleApplied =
    Boolean(wholesaleCustomer) && pieces >= WHOLESALE_MIN_QTY;

  const effectiveItemPriceMode = useMemo(() => {
    if (wholesaleApplied) return null;
    return isPlainObject(itemPriceMode) ? itemPriceMode : {};
  }, [itemPriceMode, wholesaleApplied]);

  const ticketWithPrices = useMemo(() => {
    return ticket.map((i) => {
      const normalPrice = Number(i.price ?? 0);
      const safeNormalPrice =
        Number.isFinite(normalPrice) && normalPrice >= 0 ? normalPrice : 0;

      const wholesaleCandidate = Number(i.wholesalePrice ?? safeNormalPrice);
      const safeWholesalePrice =
        Number.isFinite(wholesaleCandidate) && wholesaleCandidate >= 0
          ? wholesaleCandidate
          : safeNormalPrice;

      const creditCandidate = Number(i.creditPrice ?? safeNormalPrice);
      const safeCreditPrice =
        Number.isFinite(creditCandidate) && creditCandidate >= 0
          ? creditCandidate
          : safeNormalPrice;

      const code = String(i.code || "").trim();
      const lineId = String(i.lineId || "").trim() || code;
      const stored =
        !wholesaleApplied && effectiveItemPriceMode
          ? String(effectiveItemPriceMode?.[lineId] || "").trim()
          : "";
      const mode = wholesaleApplied
        ? "mayoreo"
        : stored === "contado" || stored === "mayoreo"
          ? stored
          : "credito";
      const unitPrice = roundMoney(
        mode === "contado"
          ? safeNormalPrice
          : mode === "mayoreo"
            ? safeWholesalePrice
            : safeCreditPrice,
      );
      const creditUnitPrice = roundMoney(safeCreditPrice);

      const pricingTag =
        mode === "contado" ? "Contado" : mode === "mayoreo" ? "Mayoreo" : "";

      return {
        ...i,
        code,
        lineId,
        creditUnitPrice,
        priceMode: mode,
        unitPrice,
        pricingTag,
        isAutoWholesale: Boolean(wholesaleApplied),
        lineTotal: unitPrice,
        creditLineTotal: creditUnitPrice,
      };
    });
  }, [ticket, wholesaleApplied, effectiveItemPriceMode]);

  const subtotal = useMemo(
    () => ticketWithPrices.reduce((sum, i) => sum + i.lineTotal, 0),
    [ticketWithPrices],
  );

  const creditSubtotal = useMemo(
    () => ticketWithPrices.reduce((sum, i) => sum + i.creditLineTotal, 0),
    [ticketWithPrices],
  );

  const pricingDiscountAmount = useMemo(() => {
    return roundMoney(Math.max(0, creditSubtotal - subtotal));
  }, [creditSubtotal, subtotal]);

  const discountPercent = useMemo(() => {
    const n = Number(discountChoice);
    if (!Number.isFinite(n)) return 0;
    return n;
  }, [discountChoice]);

  const percentDiscountAmount = useMemo(() => {
    if (!discountPercent) return 0;
    return roundMoney((subtotal * discountPercent) / 100);
  }, [discountPercent, subtotal]);
  const total = useMemo(() => {
    return roundMoney(Math.max(0, subtotal - percentDiscountAmount));
  }, [subtotal, percentDiscountAmount]);
  const itemsCount = useMemo(() => ticketWithPrices.length, [ticketWithPrices]);

  function showMessage(next) {
    setMessage(next);
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => setMessage(null), 5000);
  }

  function addByScan(code) {
    const product = getProductByCode(products, code);
    if (!product) {
      showMessage({ type: "error", text: `Código no encontrado: ${code}` });
      return;
    }
    const category = getCategoryById(categories, product.categoryId);
    const price = Number(category?.price ?? 0);
    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
    const wholesaleCandidate = Number(category?.wholesalePrice ?? safePrice);
    const safeWholesalePrice =
      Number.isFinite(wholesaleCandidate) && wholesaleCandidate >= 0
        ? wholesaleCandidate
        : safePrice;
    const creditCandidate = Number(category?.creditPrice ?? safePrice);
    const safeCreditPrice =
      Number.isFinite(creditCandidate) && creditCandidate >= 0
        ? creditCandidate
        : safePrice;
    const tallaLabel = getProductName(product);
    const categoryName = category?.name || product.categoryId;
    const productLabel = `${categoryName}${tallaLabel ? ` · ${tallaLabel}` : ""}`;

    setTicket((prev) => {
      return [
        ...prev,
        {
          lineId: newLineId(),
          code: product.code,
          name: productLabel,
          categoryId: product.categoryId,
          categoryName,
          price: safePrice,
          creditPrice: safeCreditPrice,
          wholesalePrice: safeWholesalePrice,
          qty: 1,
        },
      ];
    });

    showMessage({ type: "ok", text: `Agregado: ${productLabel}` });
  }

  function removeLine(lineId) {
    const id = String(lineId || "").trim();
    if (!id) return;
    setTicket((prev) => {
      return prev.filter((i) => String(i?.lineId || "").trim() !== id);
    });
    setItemPriceMode((prevModes) => {
      const base = isPlainObject(prevModes) ? { ...prevModes } : {};
      delete base[id];
      return base;
    });
  }

  function clearTicket() {
    setTicket([]);
    setItemPriceMode({});
    showMessage({ type: "ok", text: "Ticket cancelado" });
  }

  async function pay(method) {
    if (!ticket.length) return;
    if (isPaying) return;
    setIsPaying(true);
    try {
      const branchId = String(persisted?.branchId || "").trim();
      const itemsMap = new Map();
      for (const i of ticketWithPrices) {
        const code = String(i.code || "").trim();
        const unitPrice = roundMoney(i.unitPrice);
        if (!code) continue;
        const key = `${code}__${unitPrice}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, { code, qty: 0, unitPrice });
        }
        const row = itemsMap.get(key);
        row.qty += 1;
      }
      const items = Array.from(itemsMap.values());
      const r = await apiSend("/api/sales", "POST", {
        branchId: branchId || undefined,
        paymentMethod: method,
        discountPercent,
        items,
      });
      const receiptNumber = String(r?.sale?.receiptNumber || "").trim();
      const saleId = String(r?.sale?.id || "").trim();
      setLastPayment({
        method,
        total,
        itemsCount,
        at: new Date(),
        receiptNumber,
        saleId,
      });
      setTicket([]);
      showMessage({
        type: "ok",
        text: receiptNumber
          ? `Pago registrado (${method}) · Ticket ${receiptNumber}`
          : `Pago registrado (${method})`,
      });
    } catch (e) {
      showMessage({
        type: "error",
        text: `No se pudo guardar la venta: ${String(e?.message || e)}`,
      });
    } finally {
      setIsPaying(false);
    }
  }

  const paymentMethodLabel = "Crédito";

  function toggleItemMode(code, mode) {
    const c = String(code || "").trim();
    if (!c) return;
    const m = String(mode || "").trim();
    if (m !== "contado" && m !== "mayoreo") return;
    setItemPriceMode((prev) => {
      const base = isPlainObject(prev) ? { ...prev } : {};
      const current = String(base?.[c] || "").trim();
      if (current === m) {
        delete base[c];
        return base;
      }
      base[c] = m;
      return base;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">POS</h1>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Escanea un código (ej. 1001 + Enter). El escáner se comporta como
            teclado.
          </div>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 print:hidden">
          Total: <span className="font-extrabold tabular-nums">${total}</span> ·
          Piezas:{" "}
          <span className="font-extrabold tabular-nums">{itemsCount}</span>
          {wholesaleCustomer ? (
            <>
              {" "}
              · Cliente mayoreo{" "}
              {pieces >= WHOLESALE_MIN_QTY ? (
                <span className="font-extrabold text-emerald-700">
                  (aplica)
                </span>
              ) : (
                <>
                  (desde{" "}
                  <span className="font-extrabold tabular-nums">
                    {WHOLESALE_MIN_QTY}
                  </span>
                  +)
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          className={[
            "rounded-2xl px-4 py-4 text-base font-extrabold print:hidden",
            message.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-emerald-600 text-white",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <ScannerCapture onScan={addByScan} hideUI />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="text-lg font-extrabold tracking-tight">Ticket</div>
          <div className="space-y-3">
            {ticketWithPrices.map((item) => (
              <TicketRow
                key={item.lineId}
                item={item}
                onPickMode={(mode) => toggleItemMode(item.lineId, mode)}
                onRemove={() => removeLine(item.lineId)}
              />
            ))}

            {!ticket.length ? (
              <div className="rounded-2xl bg-white p-5 text-base font-semibold text-slate-600 ring-1 ring-slate-200">
                Escanea productos para iniciar el ticket.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-lg font-extrabold tracking-tight">Cobro</div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="grid grid-cols-1 gap-3">
              <BigButton
                className="w-full"
                disabled={!ticket.length || isPaying}
                onClick={() => pay(paymentMethodLabel)}
              >
                Cobrar
              </BigButton>
              <BigButton
                className="w-full"
                variant="danger"
                onClick={clearTicket}
              >
                Cancelar
              </BigButton>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                <input
                  type="checkbox"
                  checked={wholesaleCustomer}
                  onChange={(e) => setWholesaleCustomer(e.target.checked)}
                  className="h-6 w-6 rounded-md"
                />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">
                    Cliente Mayoreo
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-600">
                    Aplica mayoreo automático desde {WHOLESALE_MIN_QTY}+ piezas
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-sm font-extrabold text-slate-700">
                  Descuento extra
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {DISCOUNT_PRESETS.map((n) => {
                    const v = String(n);
                    const isSelected = discountChoice === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setDiscountChoice((prev) => (prev === v ? "" : v))
                        }
                        className={
                          "h-12 rounded-2xl px-3 text-base font-extrabold ring-1 focus:outline-none focus:ring-2 focus:ring-slate-900" +
                          (isSelected
                            ? " bg-slate-900 text-white ring-slate-900"
                            : " bg-white text-slate-900 ring-slate-200")
                        }
                      >
                        {n}%
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-sm font-extrabold text-slate-700">Total</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums">
                ${total}
              </div>
              {pricingDiscountAmount > 0 ? (
                <div className="mt-2 text-sm font-semibold text-emerald-700">
                  Descuento por precios: -$
                  <span className="font-extrabold tabular-nums">
                    {pricingDiscountAmount}
                  </span>
                </div>
              ) : null}
              {discountPercent ? (
                <div className="mt-2 text-sm font-semibold text-slate-700">
                  Descuento extra: {discountPercent}% · -$
                  <span className="font-extrabold tabular-nums">
                    {percentDiscountAmount}
                  </span>
                </div>
              ) : null}
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Piezas:{" "}
                <span className="font-extrabold tabular-nums">
                  {itemsCount}
                </span>
              </div>
            </div>

            {lastPayment ? (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <div className="text-sm font-extrabold text-emerald-800">
                  Último pago
                </div>
                <div className="mt-1 text-sm font-semibold text-emerald-900">
                  {lastPayment.method} ·{" "}
                  <span className="font-extrabold tabular-nums">
                    ${lastPayment.total}
                  </span>{" "}
                  ·{" "}
                  <span className="font-extrabold tabular-nums">
                    {lastPayment.itemsCount}
                  </span>{" "}
                  piezas
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
