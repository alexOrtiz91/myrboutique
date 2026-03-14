import { useEffect, useMemo, useRef, useState } from "react";

export default function ScannerCapture({
  onScan,
  className = "",
  autoFocus = true,
  globalCapture = true,
  hideUI = false,
  placeholder = "Listo para escanear…",
}) {
  const inputRef = useRef(null);
  const onScanRef = useRef(onScan);
  const bufferRef = useRef("");
  const [buffer, setBuffer] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [lastAt, setLastAt] = useState(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

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
    const focusInput = () => {
      if (!inputRef.current) return;
      if (document.activeElement === inputRef.current) return;
      inputRef.current.focus();
    };

    focusInput();

    const interval = window.setInterval(focusInput, 500);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") focusInput();
    };
    window.addEventListener("focus", focusInput);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", focusInput);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [autoFocus]);

  function commitScan(code) {
    const normalized = String(code || "").trim();
    if (!normalized) return;
    setLastScan(normalized);
    setLastAt(new Date());
    bufferRef.current = "";
    setBuffer("");
    onScanRef.current?.(normalized);
  }

  function updateBuffer(next) {
    const v = String(next || "");
    bufferRef.current = v;
    setBuffer(v);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitScan(bufferRef.current);
      return;
    }

    if (e.key === "Escape") {
      updateBuffer("");
      return;
    }

    if (e.key === "Backspace") {
      updateBuffer(bufferRef.current.slice(0, -1));
      return;
    }

    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      updateBuffer(bufferRef.current + e.key);
    }
  }

  useEffect(() => {
    if (!globalCapture) return;
    function onWindowKeyDown(e) {
      const el = e?.target;
      const tag = String(el?.tagName || "").toLowerCase();
      const isTypingTarget =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        Boolean(el?.isContentEditable);
      if (isTypingTarget) return;
      onKeyDown(e);
    }
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [globalCapture]);

  const inputEl = (
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
        if (autoFocus) {
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
      className="absolute opacity-0 pointer-events-none"
      aria-hidden="true"
      tabIndex={0}
    />
  );

  if (hideUI) return inputEl;

  return (
    <div
      className={[
        "rounded-2xl bg-white p-4 ring-1 ring-slate-200",
        className,
      ].join(" ")}
    >
      {inputEl}

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
      </div>
    </div>
  );
}
