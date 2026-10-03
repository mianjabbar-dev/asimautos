import { loginAction } from "./actions";
import { Button, Input, Field, Alert } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-900 text-xl font-black text-white">
            AA
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ASIM AUTOS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Auto Parts Management System
          </p>
        </div>
        <form
          action={loginAction}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {params.next && <input type="hidden" name="next" value={params.next} />}
          <div className="space-y-4">
            {params.error && <Alert tone="danger">{params.error}</Alert>}
            <Field label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@asimautos.pk"
                required
              />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </Field>
            <Button type="submit" className="w-full" size="lg">
              Sign in
            </Button>
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Authorized staff only. Contact the owner for an account.
        </p>
      </div>
    </main>
  );
}
