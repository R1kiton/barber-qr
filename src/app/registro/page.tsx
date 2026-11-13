import Link from "next/link";
import RegisterForm from "./RegisterForm";

export default function RegistroPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Inicio
        </Link>
        <h1 className="mt-4 font-display text-4xl tracking-tight">Registra tu barbería</h1>
        <p className="mt-2 text-muted">
          Al terminar tendrás tu enlace de reservas y un panel para ver las citas y escanear el QR de
          cada cliente cuando llegue.
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
