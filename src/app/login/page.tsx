"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarHeart } from "lucide-react";
import { api } from "@/lib/client";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/feedback";

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/login", { identifier, password });
      router.push(params.get("next") ?? "/app");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <Link href="/" className="mb-8 flex justify-center"><Brand tone="cream" size={44} /></Link>
        <div className="rounded-card bg-white p-6 shadow-2xl sm:p-7">
          <h1 className="mb-1 text-xl font-bold">تسجيل الدخول</h1>
          <p className="mb-6 text-sm text-muted">أهلًا بعودتك — تابع إدارة مناسباتك.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="البريد الإلكتروني أو رقم الهاتف" htmlFor="identifier">
              <Input id="identifier" dir="ltr" className="text-left" placeholder="you@example.com / +9665..."
                value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
            </Field>
            <Field label="كلمة المرور" htmlFor="password">
              <Input id="password" type="password" dir="ltr" className="text-left"
                value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="w-full" size="lg" loading={loading}>دخول</Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            ما عندك حساب؟ <Link href="/register" className="font-bold text-navy-950 underline decoration-lime-400 decoration-2 underline-offset-4">أنشئ حسابًا مجانًا</Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-ivory/40">استعادة الحساب و2FA للمشرفين: ضمن مرحلة التشغيل القادمة.</p>
      </div>
    </div>
  );
}
