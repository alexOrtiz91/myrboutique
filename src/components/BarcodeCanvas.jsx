import bwipjs from "bwip-js";
import { useEffect, useRef, useState } from "react";

export default function BarcodeCanvas({ text, className = "" }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = canvasRef.current;
    const value = String(text || "");
    let nextError = "";
    if (!el) {
      Promise.resolve().then(() => setError(""));
      return;
    }
    try {
      bwipjs.toCanvas(el, {
        bcid: "code128",
        text: value,
        scale: 2,
        height: 8,
        includetext: false,
        backgroundcolor: "FFFFFF",
      });
    } catch (e) {
      nextError = e?.message || String(e);
    }
    Promise.resolve().then(() => setError(nextError));
  }, [text]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-auto w-full" />
      {error ? (
        <div className="mt-2 text-xs font-semibold text-rose-600">{error}</div>
      ) : null}
    </div>
  );
}
