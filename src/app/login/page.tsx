import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth";
import LoginForm from "../admin/[slug]/LoginForm";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <main className="ui-plain flex-1">
      <div className="px-5 py-16 sm:py-24">
        <Suspense fallback={<p className="text-center text-muted">Cargando…</p>}><Login searchParams={searchParams} /></Suspense>
      </div>
    </main>
  );
}

async function Login({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const owner = await currentOwner();
  if (owner) {
    const safeNext = new RegExp(`^/admin/${owner.slug}/checkin/[a-f0-9-]{36}$`, "i").test(next);
    redirect(safeNext ? next : `/admin/${owner.slug}`);
  }
  return <LoginForm next={/^\/admin\/[a-z0-9-]+\/checkin\/[a-f0-9-]{36}$/i.test(next) ? next : undefined} />;
}
