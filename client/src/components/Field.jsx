export default function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  className = "",
  inputRef,
  ...props
}) {
  return (
    <label className={["block", className].join(" ")}>
      <div className="text-sm font-extrabold text-slate-700">{label}</div>
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        className={[
          "mt-2 h-14 w-full rounded-2xl bg-white px-4 py-0 text-lg font-semibold leading-[3.5rem]",
          "ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900",
        ].join(" ")}
        {...props}
      />
    </label>
  );
}
