import { Link } from "react-router-dom";

const cards = [
  {
    to: "/tienda-admin",
    title: "Tienda Admin",
    subtitle: "Catálogos, productos e inventario (tablet/PC)",
  },
  {
    to: "/etiquetas",
    title: "Etiquetas",
    subtitle: "Códigos de barras / QR + hoja imprimible",
  },
  {
    to: "/pos-demo",
    title: "POS",
    subtitle: "Ticket simple y flujo de escaneo (tablet)",
  },
  {
    to: "/inventario-demo",
    title: "Inventario",
    subtitle: "Conteo rápido por categoría usando escáner",
  },
];

function Card({ to, title, subtitle }) {
  return (
    <Link
      to={to}
      className={[
        "rounded-2xl bg-white p-6 ring-1 ring-slate-200",
        "active:scale-[0.99] active:bg-slate-50",
        "transition",
        "min-h-28",
      ].join(" ")}
    >
      <div className="text-xl font-extrabold tracking-tight">{title}</div>
      <div className="mt-1 text-base font-medium text-slate-600">
        {subtitle}
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-slate-900 p-6 text-white">
        <div className="text-2xl font-extrabold tracking-tight">
          Prototipo de inventario + ventas
        </div>
        <div className="mt-2 text-base font-medium text-slate-200">
          Sin autenticación ni backend real. Enfocado en UX táctil y flujo de
          escaneo.
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.to} to={c.to} title={c.title} subtitle={c.subtitle} />
        ))}
      </section>
    </div>
  );
}
