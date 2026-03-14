import { NavLink } from "react-router-dom";
import logoPngUrl from "../assets/logo.png";

const navItems = [
  { to: "/tienda-admin", label: "Tienda Admin" },
  { to: "/etiquetas", label: "Etiquetas" },
  { to: "/separadores", label: "Separadores" },
  { to: "/pos-demo", label: "POS" },
  { to: "/inventario-demo", label: "Inventario" },
];

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "inline-flex shrink-0 items-center justify-center rounded-xl px-3 py-2 text-center text-sm font-semibold leading-tight lg:px-4 lg:py-3 lg:text-base",
          isActive
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-900 ring-1 ring-slate-200",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="w-full px-4 sm:px-6 py-4 lg:mx-auto lg:max-w-7xl">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3 sm:shrink-0">
              <img
                src={logoPngUrl}
                alt="MYR Boutique"
                className="h-10 w-auto"
              />
              <a
                href="/"
                className="rounded-xl bg-slate-100 px-4 py-3 text-base font-semibold text-slate-900 ring-1 ring-slate-200 sm:hidden"
              >
                Inicio
              </a>
            </div>
            <nav className="flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-1 sm:justify-end sm:pb-0 lg:gap-3">
              {navItems.map((item) => (
                <NavItem key={item.to} to={item.to} label={item.label} />
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-6 sm:px-6 lg:mx-auto lg:max-w-7xl print:mx-0 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
