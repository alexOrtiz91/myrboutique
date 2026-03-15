import { useEffect, useMemo, useState } from "react";
import SelectField from "../components/SelectField.jsx";
import BigButton from "../components/BigButton.jsx";
import { apiGet, apiSend } from "../api.js";

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

function formatMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function formatDateTime(value) {
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function VentasPage() {
  const [persisted] = useState(() => readJson(STORAGE_KEY));
  const [dataSource, setDataSource] = useState("checking");

  const [branches, setBranches] = useState(() => {
    return Array.isArray(persisted?.branches) ? persisted.branches : [];
  });
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return String(persisted?.branchId || "").trim();
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

  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [saleDetail, setSaleDetail] = useState(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [message, setMessage] = useState(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  function showMessage(next) {
    setMessage(next);
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => setMessage(null), 2400);
  }

  async function refreshSales(branchId) {
    const id = String(branchId || "").trim();
    if (!id) return;
    setLoadingSales(true);
    try {
      const r = await apiGet(
        `/api/sales?branchId=${encodeURIComponent(id)}&limit=150`,
      );
      const next = Array.isArray(r?.sales) ? r.sales : [];
      setSales(next);
      if (!next.some((s) => String(s?.id || "").trim() === selectedSaleId)) {
        setSelectedSaleId("");
        setSaleDetail(null);
      }
    } catch (e) {
      showMessage({
        type: "error",
        text: `No se pudieron cargar ventas: ${String(e?.message || e)}`,
      });
    } finally {
      setLoadingSales(false);
    }
  }

  async function openSale(saleId, branchId) {
    const id = String(saleId || "").trim();
    const b = String(branchId || "").trim();
    if (!id || !b) return;
    setSelectedSaleId(id);
    setLoadingDetail(true);
    try {
      const r = await apiGet(
        `/api/sales/${encodeURIComponent(id)}?branchId=${encodeURIComponent(b)}`,
      );
      setSaleDetail(r || null);
    } catch (e) {
      setSaleDetail(null);
      showMessage({
        type: "error",
        text: `No se pudo cargar el desglose: ${String(e?.message || e)}`,
      });
    } finally {
      setLoadingDetail(false);
    }
  }

  async function performCancelSelectedSale() {
    const b = String(effectiveBranchId || "").trim();
    const id = String(selectedSaleId || "").trim();
    if (!b || !id) return;
    if (isCanceling) return;

    setIsCanceling(true);
    try {
      await apiSend(`/api/sales/${encodeURIComponent(id)}/cancel`, "POST", {
        branchId: b,
      });
      await refreshSales(b);
      await openSale(id, b);
      showMessage({ type: "ok", text: "Venta cancelada" });
    } catch (e) {
      showMessage({
        type: "error",
        text: `No se pudo cancelar: ${String(e?.message || e)}`,
      });
    } finally {
      setIsCanceling(false);
    }
  }

  function requestCancelSelectedSale() {
    const id = String(selectedSaleId || "").trim();
    if (!id) return;
    setIsCancelConfirmOpen(true);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiGet("/api/db/health");
        const branchesRes = await apiGet("/api/branches");
        const apiBranches = Array.isArray(branchesRes?.branches)
          ? branchesRes.branches
          : [];
        if (!alive) return;
        setBranches(apiBranches);

        const persistedBranchId = String(persisted?.branchId || "").trim();
        const defaultBranchId = apiBranches.some(
          (b) => String(b?.id || "").trim() === persistedBranchId,
        )
          ? persistedBranchId
          : String(apiBranches[0]?.id || "").trim();
        setSelectedBranchId(defaultBranchId);
        const current = readJson(STORAGE_KEY) || {};
        writeJson(STORAGE_KEY, { ...current, branchId: defaultBranchId });
        setDataSource("api");
      } catch {
        if (!alive) return;
        setDataSource("unavailable");
      }
    })();
    return () => {
      alive = false;
    };
  }, [persisted]);

  useEffect(() => {
    if (dataSource !== "api") return;
    if (!effectiveBranchId) return;
    void refreshSales(effectiveBranchId);
  }, [dataSource, effectiveBranchId]);

  const selectedSale = saleDetail?.sale || null;
  const selectedItems = Array.isArray(saleDetail?.items)
    ? saleDetail.items
    : [];
  const isSelectedCanceled = Boolean(selectedSale?.canceledAt);

  return (
    <div className="space-y-5">
      {isCancelConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="text-lg font-extrabold tracking-tight">
              Cancelar venta
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-700">
              Esto regresa el stock a la tienda. ¿Seguro que deseas continuar?
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <BigButton
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={isCanceling}
                onClick={() => setIsCancelConfirmOpen(false)}
              >
                No
              </BigButton>
              <BigButton
                variant="danger"
                className="w-full sm:w-auto"
                disabled={isCanceling}
                onClick={async () => {
                  setIsCancelConfirmOpen(false);
                  await performCancelSelectedSale();
                }}
              >
                Sí, cancelar
              </BigButton>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Ventas</h1>
          <div className="mt-1 text-sm font-semibold text-slate-600">
            Historial de ventas y desglose por ticket.
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

      {message ? (
        <div
          className={[
            "rounded-2xl px-4 py-4 text-base font-extrabold",
            message.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-emerald-600 text-white",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      {dataSource !== "api" ? (
        <div className="rounded-2xl bg-white p-5 text-base font-semibold text-slate-700 ring-1 ring-slate-200">
          No hay conexión a la base de datos para consultar ventas.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="space-y-3">
            <div className="flex min-h-14 items-center justify-between gap-3">
              <div className="text-lg font-extrabold tracking-tight">
                Tickets
              </div>
            </div>

            <div className="space-y-3">
              {loadingSales ? (
                <div className="flex min-h-24 items-center rounded-2xl bg-white p-5 text-base font-semibold text-slate-600 ring-1 ring-slate-200">
                  Cargando ventas…
                </div>
              ) : !sales.length ? (
                <div className="flex min-h-24 items-center rounded-2xl bg-white p-5 text-base font-semibold text-slate-600 ring-1 ring-slate-200">
                  Aún no hay ventas registradas.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  {sales.map((s) => {
                    const id = String(s?.id || "").trim();
                    const isSelected = id && id === selectedSaleId;
                    const isCanceled = Boolean(s?.canceledAt);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => openSale(id, effectiveBranchId)}
                        className={[
                          "w-full px-4 py-4 text-left",
                          isSelected ? "bg-slate-50" : "bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-extrabold">
                              Ticket{" "}
                              {String(s?.receiptNumber || "").trim() || "—"}
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-slate-600">
                              {String(s?.paymentMethod || "").trim() || "—"} ·{" "}
                              {Number(s?.itemsCount ?? 0)} artículos ·{" "}
                              {formatDateTime(s?.createdAt)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-base font-extrabold tabular-nums">
                              {formatMoney(s?.total)}
                            </div>
                            {isCanceled ? (
                              <div className="mt-1 inline-flex rounded-xl bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200">
                                Cancelada
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex min-h-14 items-center justify-between gap-3">
              <div className="text-lg font-extrabold tracking-tight">
                Desglose
              </div>
              {selectedSale ? (
                <BigButton
                  variant="danger"
                  className="shrink-0"
                  disabled={isSelectedCanceled || isCanceling}
                  onClick={requestCancelSelectedSale}
                >
                  Cancelar venta
                </BigButton>
              ) : null}
            </div>

            {!selectedSaleId ? (
              <div className="flex min-h-24 items-center rounded-2xl bg-white p-5 text-base font-semibold text-slate-600 ring-1 ring-slate-200">
                Selecciona un ticket para ver el detalle.
              </div>
            ) : loadingDetail ? (
              <div className="flex min-h-24 items-center rounded-2xl bg-white p-5 text-base font-semibold text-slate-600 ring-1 ring-slate-200">
                Cargando desglose…
              </div>
            ) : !selectedSale ? (
              <div className="flex min-h-24 items-center rounded-2xl bg-white p-5 text-base font-semibold text-slate-600 ring-1 ring-slate-200">
                No se encontró la venta.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-extrabold tracking-tight">
                        Ticket {selectedSale.receiptNumber || "—"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        {selectedSale.paymentMethod || "—"} ·{" "}
                        {formatDateTime(selectedSale.createdAt)}
                      </div>
                      {isSelectedCanceled ? (
                        <div className="mt-2 inline-flex rounded-xl bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200">
                          Cancelada · {formatDateTime(selectedSale.canceledAt)}
                        </div>
                      ) : null}
                      {isSelectedCanceled && selectedSale.canceledReason ? (
                        <div className="mt-2 text-sm font-semibold text-slate-600">
                          Motivo: {selectedSale.canceledReason}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-extrabold text-slate-700">
                        Subtotal:{" "}
                        <span className="font-extrabold tabular-nums">
                          {formatMoney(selectedSale.subtotal)}
                        </span>
                      </div>
                      <div className="mt-1 text-base font-extrabold text-slate-900">
                        Total:{" "}
                        <span className="font-extrabold tabular-nums">
                          {formatMoney(selectedSale.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
                  <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-2">Código</div>
                    <div className="col-span-1 text-right">Qty</div>
                    <div className="col-span-1 text-right">Precio</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {selectedItems.map((it, idx) => {
                      const labelParts = [
                        String(it?.categoryName || "").trim(),
                        it?.talla ? `Talla ${String(it.talla).trim()}` : "",
                      ].filter(Boolean);
                      const label = labelParts.join(" · ") || "—";
                      return (
                        <div
                          key={`${String(it?.code || "").trim()}_${idx}`}
                          className="grid grid-cols-12 items-start gap-2 px-4 py-3"
                        >
                          <div className="col-span-6 min-w-0">
                            <div className="truncate text-sm font-extrabold text-slate-900">
                              {label}
                            </div>
                          </div>
                          <div className="col-span-2 text-sm font-semibold text-slate-700">
                            {String(it?.code || "").trim() || "—"}
                          </div>
                          <div className="col-span-1 text-right text-sm font-extrabold tabular-nums text-slate-900">
                            {Number(it?.qty ?? 0)}
                          </div>
                          <div className="col-span-1 text-right text-sm font-semibold tabular-nums text-slate-700">
                            {formatMoney(it?.unitPrice)}
                          </div>
                          <div className="col-span-2 text-right text-sm font-extrabold tabular-nums text-slate-900">
                            {formatMoney(it?.lineTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
