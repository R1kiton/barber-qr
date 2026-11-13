import Link from "next/link";

export default async function SiteFooter() {
  "use cache";

  return (
    <footer className="site-footer">
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-14 sm:pt-16">
        <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:gap-16">
          <div>
            <Link
              href="/"
              aria-label="BarberQR, inicio"
              className="footer-brand inline-block font-display text-5xl tracking-tight sm:text-6xl"
            >
              Barber<span className="text-brass">QR</span>
            </Link>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-muted">
              Tu próxima cita, sin complicaciones.
              <br />
              Reserva, escanea y disfruta.
            </p>
          </div>

          <nav aria-label="Navegación del pie de página" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:gap-x-16">
            <div>
              <h2 className="font-display text-xl text-ink">Tu próxima cita</h2>
              <ul className="mt-4 space-y-1">
                <li><Link href="/barberias" className="footer-link">Explorar barberías</Link></li>
                <li><Link href="/#clientes" className="footer-link">Nuestros clientes</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="font-display text-xl text-ink">Tu barbería</h2>
              <ul className="mt-4 space-y-1">
                <li><Link href="/#para-barberias" className="footer-link">Nuestros servicios</Link></li>
                <li><Link href="/login" className="footer-link">Acceder a mi barbería</Link></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 text-sm text-muted sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BarberQR. Todos los derechos reservados.</p>
          <a href="#inicio" className="footer-link inline-flex w-fit items-center gap-2">
            Volver al inicio <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
