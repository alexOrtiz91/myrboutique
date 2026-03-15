import BigButton from "./BigButton.jsx";

export default function ModalDialog({
  open,
  title,
  text,
  kind = "alert",
  confirmLabel = "OK",
  cancelLabel = "Cancelar",
  disabled = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const safeTitle = String(title || "").trim();
  const safeText = String(text || "").trim();
  const isConfirm = String(kind || "") === "confirm";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        {safeTitle ? (
          <div className="text-lg font-extrabold tracking-tight">
            {safeTitle}
          </div>
        ) : null}
        {safeText ? (
          <div className={[safeTitle ? "mt-2" : "", "text-sm font-semibold text-slate-700"].join(" ")}>
            {safeText}
          </div>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {isConfirm ? (
            <BigButton
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={disabled}
              onClick={onCancel}
            >
              {cancelLabel}
            </BigButton>
          ) : null}
          <BigButton
            variant={isConfirm ? "danger" : "primary"}
            className="w-full sm:w-auto"
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </BigButton>
        </div>
      </div>
    </div>
  );
}

