import { useEffect, useMemo, useRef, useState } from "react";

export default function ScannerCapture({
  onScan,
  className = "",
  autoFocus = true,
  placeholder = "Listo para escanear…",
}) {
  const inputRef = useRef(null);
  const [buffer, setBuffer] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [lastAt, setLastAt] = useState(null);

  const lastAtLabel = useMemo(() => {
    if (!lastAt) return "";
    try {
      return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(lastAt);
    } catch {
      return String(lastAt);
    }
  }, [lastAt]);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [autoFocus]);

  function commitScan(code) {
    const normalized = String(code || "").trim();
    if (!normalized) return;
    setLastScan(normalized);
    setLastAt(new Date());
    setBuffer("");
    onScan?.(normalized);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitScan(buffer);
      return;
    }

    if (e.key === "Escape") {
      setBuffer("");
      return;
    }

    if (e.key === "Backspace") {
      setBuffer((v) => v.slice(0, -1));
      return;
    }

    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setBuffer((v) => v + e.key);
    }
  }

  return (
    <div
      className={[
        "rounded-2xl bg-white p-4 ring-1 ring-slate-200",
        className,
      ].join(" ")}
    >
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={onKeyDown}
        inputMode="none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onBlur={() => {
          if (autoFocus) inputRef.current?.focus();
        }}
        className="absolute -left-[9999px] top-0 h-0 w-0 opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-700">
            Escáner (HID teclado)
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">
            {buffer ? (
              <>
                Capturando: <span className="font-extrabold">{buffer}</span>
              </>
            ) : (
              placeholder
            )}
          </div>
          {lastScan ? (
            <div className="mt-1 text-sm font-semibold text-slate-500">
              Último: {lastScan} {lastAtLabel ? `· ${lastAtLabel}` : ""}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="rounded-2xl bg-slate-900 px-5 py-4 text-lg font-extrabold text-white"
        >
          Activar escaneo
        </button>
      </div>
    </div>
  );
}
