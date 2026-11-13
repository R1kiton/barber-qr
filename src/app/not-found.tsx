import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="font-display text-4xl">No encontramos esta página</h1>
        <p className="mt-3 text-muted">Puede que el enlace o el código QR estén mal escritos.</p>
        <Link href="/" className="btn mt-8">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
