import { Suspense } from "react";
import Link from "next/link";
import { pendingRegistration } from "@/services/registration.service";
import VerificationForm from "./VerificationForm";

export default function VerifyPage() {
  return (
    <main className="ui-plain flex-1">
      <div className="mx-auto max-w-lg px-5 py-16">
        <Suspense fallback={<p className="text-muted">Cargando…</p>}><Verification /></Suspense>
      </div>
    </main>
  );
}

async function Verification() {
  const current = await pendingRegistration();
  if (!current) return (
    <div>
      <h1 className="font-display text-3xl">El registro ha caducado</h1>
      <p className="mt-4 text-muted">Vuelve a ingresar los datos para recibir un nuevo código. Tu barbería aún no se ha creado.</p>
      <Link href="/registro" className="btn mt-8">Volver al registro</Link>
    </div>
  );
  return (
    <div className="rounded-2xl bg-card p-6 sm:p-8">
      <h1 className="font-display text-3xl">Verifica tu correo</h1>
      <p className="mt-4 text-muted">Enviamos un código a <strong className="break-all text-ink">{current.pending.email}</strong>. Revisa también la carpeta de spam.</p>
      <VerificationForm />
      <Link href="/registro" className="mt-6 inline-block text-sm text-brass-ink underline underline-offset-4">Cambiar correo o datos</Link>
    </div>
  );
}
