export default function SelectField({
  label,
  value,
  onChange,
  options,
  className = "",
  ...props
}) {
  return (
    <label className={["block", className].join(" ")}>
      <div className="text-sm font-extrabold text-slate-700">{label}</div>
      <select
        value={value}
        onChange={onChange}
        className={[
          "mt-2 h-14 w-full rounded-2xl bg-white px-4 py-0 text-lg font-semibold",
          "ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900",
          props.disabled ? "opacity-60" : "",
        ].join(" ")}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
