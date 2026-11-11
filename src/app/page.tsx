import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1">
      <div className="pole" />
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-20 grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-ink">BarberQR</p>
          <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
            Reserva, llega
            <br />
            <em className="text-brass">y muestra tu QR.</em>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Tus clientes reservan desde el celular en menos de un minuto y reciben un código QR con su
            cita. Al llegar, lo escaneas y la llegada queda confirmada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className="btn">
              Registrar mi barbería
            </Link>
            <Link href="/b/barberia-demo" className="btn btn-ghost">
              Probar la demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Panel de la demo:{" "}
            <Link href="/admin/barberia-demo" className="underline underline-offset-4">
              /admin/barberia-demo
            </Link>{" "}
            · PIN 1234
          </p>
        </div>

        <ol className="grid gap-3">
          {[
            ["01", "El cliente reserva", "Elige servicio, barbero y hora desde tu enlace."],
            ["02", "Recibe su QR", "Con los datos de la cita, listo para guardar en el celular."],
            ["03", "Lo escaneas al llegar", "Confirmas la llegada y la ves en tu agenda."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4 rounded-2xl border border-line bg-card p-5">
              <span className="font-display text-2xl text-brass">{n}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
