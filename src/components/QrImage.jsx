import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function QrImage({ text, className = "" }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setError("");
      setDataUrl("");
    });

    const value = String(text || "");
    if (!value) return;

    QRCode.toDataURL(value, { margin: 1, width: 240 })
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (error)
    return (
      <div
        className={["text-xs font-semibold text-rose-600", className].join(" ")}
      >
        {error}
      </div>
    );
  if (!dataUrl)
    return (
      <div
        className={[
          "aspect-square w-full rounded-xl bg-slate-100",
          className,
        ].join(" ")}
      />
    );

  return (
    <img
      alt="QR"
      src={dataUrl}
      className={["h-auto w-full", className].join(" ")}
    />
  );
}
