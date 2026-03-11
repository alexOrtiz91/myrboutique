export default function BigButton({
  children,
  className = "",
  variant = "primary",
  ...props
}) {
  const base =
    "inline-flex h-14 items-center justify-center rounded-2xl px-5 py-0 text-lg font-extrabold tracking-tight active:scale-[0.99] transition";

  const styles = {
    primary: "bg-slate-900 text-white",
    secondary: "bg-white text-slate-900 ring-1 ring-slate-200",
    danger: "bg-rose-600 text-white",
  };

  return (
    <button
      type="button"
      className={[base, styles[variant], className].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
