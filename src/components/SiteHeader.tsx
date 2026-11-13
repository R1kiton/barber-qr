import Link from "next/link";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/barberias", label: "Barberías" },
  { href: "/#para-barberias", label: "unirse" },
    { href: "/login", label: "Mi barberia" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-4 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-8 md:py-5">
          <Link
            href="/"
            className="font-display text-xl tracking-tight transition-colors hover:text-brass-ink md:justify-self-start"
          >
            Barber<span className="text-brass">QR</span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 md:gap-x-7 lg:gap-x-10"
          >
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* En un div aparte: `hidden` y `.btn` compiten por `display`, y .btn gana. */}
          <div className="hidden md:block md:justify-self-end">
            <Link href="/registro" className="btn btn-sm">
              Registra tu barbería
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
