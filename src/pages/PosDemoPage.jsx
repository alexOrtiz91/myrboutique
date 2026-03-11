import { useEffect, useMemo, useState } from "react";
import BigButton from "../components/BigButton.jsx";
import ScannerCapture from "../components/ScannerCapture.jsx";
import { apiGet } from "../api.js";
import {
  getCategoryById,
  getProductByCode,
  getProductName,
} from "../mocks/catalog.js";

const STORAGE_KEY = "myrboutique:tienda-admin:v1";
const WHOLESALE_MIN_QTY = 15;

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

function TicketRow({ item, onDec, onInc }) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200">
      <div className="col-span-7 min-w-0">
        <div className="truncate text-base font-extrabold">{item.name}</div>
        <div className="mt-1 truncate text-sm font-semibold text-slate-600">
          {item.categoryName}
          {item.wholesaleApplied ? " · Mayoreo" : ""}
        </div>
      </div>
      <div className="col-span-2 text-right text-base font-extrabold tabular-nums">
        ${item.unitPrice}
      </div>
      <div className="col-span-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDec}
          className="h-12 w-12 rounded-2xl bg-slate-100 text-xl font-extrabold text-slate-900 ring-1 ring-slate-200"
        >
          -
        </button>
        <div className="w-10 text-center text-lg font-extrabold tabular-nums">
          {item.qty}
        </div>
        <button
          type="button"
          onClick={onInc}
          className="h-12 w-12 rounded-2xl bg-slate-900 text-xl font-extrabold text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function PosDemoPage() {
  const [persisted] = useState(() => readJson(STORAGE_KEY));
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
      return {
        ...c,
        price: safeNormalPrice,
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
  const [ticket, setTicket] = useState([]);
  const [message, setMessage] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);

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
          return {
            ...c,
            price: safeNormalPrice,
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

  const ticketWithPrices = useMemo(() => {
    const pieces = ticket.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    const wholesaleApplied = pieces >= WHOLESALE_MIN_QTY;

    return ticket.map((i) => {
      const normalPrice = Number(i.price ?? 0);
      const safeNormalPrice =
        Number.isFinite(normalPrice) && normalPrice >= 0 ? normalPrice : 0;

      const wholesaleCandidate = Number(i.wholesalePrice ?? safeNormalPrice);
      const safeWholesalePrice =
        Number.isFinite(wholesaleCandidate) && wholesaleCandidate >= 0
          ? wholesaleCandidate
          : safeNormalPrice;

      const unitPrice = wholesaleApplied ? safeWholesalePrice : safeNormalPrice;

      return {
        ...i,
        unitPrice,
        wholesaleApplied,
        lineTotal: unitPrice * (Number(i.qty) || 0),
      };
    });
  }, [ticket]);

  const total = useMemo(
    () => ticketWithPrices.reduce((sum, i) => sum + i.lineTotal, 0),
    [ticketWithPrices],
  );
  const itemsCount = useMemo(
    () => ticketWithPrices.reduce((sum, i) => sum + i.qty, 0),
    [ticketWithPrices],
  );

  function showMessage(next) {
    setMessage(next);
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => setMessage(null), 2200);
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
    const tallaLabel = getProductName(product);
    const categoryName = category?.name || product.categoryId;
    const productLabel = `${categoryName}${tallaLabel ? ` · ${tallaLabel}` : ""}`;

    setTicket((prev) => {
      const idx = prev.findIndex(
        (i) => String(i.code) === String(product.code),
      );
      if (idx === -1) {
        return [
          ...prev,
          {
            code: product.code,
            name: productLabel,
            categoryId: product.categoryId,
            categoryName,
            price: safePrice,
            wholesalePrice: safeWholesalePrice,
            qty: 1,
          },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });

    showMessage({ type: "ok", text: `Agregado: ${productLabel}` });
  }

  function decItem(code) {
    setTicket((prev) => {
      const idx = prev.findIndex((i) => String(i.code) === String(code));
      if (idx === -1) return prev;
      const item = prev[idx];
      if (item.qty <= 1)
        return prev.filter((i) => String(i.code) !== String(code));
      const next = [...prev];
      next[idx] = { ...item, qty: item.qty - 1 };
      return next;
    });
  }

  function incItem(code) {
    setTicket((prev) => {
      const idx = prev.findIndex((i) => String(i.code) === String(code));
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
  }

  function clearTicket() {
    setTicket([]);
    showMessage({ type: "ok", text: "Ticket cancelado" });
  }

  function pay(method) {
    if (!ticket.length) return;
    setLastPayment({ method, total, itemsCount, at: new Date() });
    setTicket([]);
    showMessage({ type: "ok", text: `Pago registrado (${method})` });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">POS Demo</h1>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Escanea un código (ej. 1001 + Enter). El escáner se comporta como
            teclado.
          </div>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 print:hidden">
          Total: <span className="font-extrabold tabular-nums">${total}</span> ·
          Artículos:{" "}
          <span className="font-extrabold tabular-nums">{itemsCount}</span>
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

      <ScannerCapture onScan={addByScan} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="text-lg font-extrabold tracking-tight">Ticket</div>
          <div className="space-y-3">
            {ticketWithPrices.map((item) => (
              <TicketRow
                key={item.code}
                item={item}
                onDec={() => decItem(item.code)}
                onInc={() => incItem(item.code)}
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
          <div className="text-lg font-extrabold tracking-tight">
            Cobro (demo)
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <BigButton className="w-full" onClick={() => pay("Efectivo")}>
                Efectivo
              </BigButton>
              <BigButton className="w-full" onClick={() => pay("Tarjeta")}>
                Tarjeta
              </BigButton>
              <BigButton
                className="col-span-2 w-full"
                variant="danger"
                onClick={clearTicket}
              >
                Cancelar
              </BigButton>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-sm font-extrabold text-slate-700">Total</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums">
                ${total}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Items:{" "}
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
                  items
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 print:hidden">
            <div className="text-sm font-extrabold text-slate-700">
              Códigos mock
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-4">
              {products.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => addByScan(p.code)}
                  className="rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200 active:scale-[0.99]"
                >
                  {p.code}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
