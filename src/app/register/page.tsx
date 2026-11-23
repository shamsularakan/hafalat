"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarHeart } from "lucide-react";
import { api } from "@/lib/client";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/feedback";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "", email: "", phone: "", password: "", orgName: "", orgKind: "individual",
  });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/register", {
        name: form.name, email: form.email || undefined, phone: form.phone || undefined,
        password: form.password, orgName: form.orgName || form.name, orgKind: form.orgKind === "vendor" ? "company" : form.orgKind,
      });
      router.push(form.orgKind === "vendor" ? "/app/vendor" : "/app");
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
          <h1 className="mb-1 text-xl font-bold">إنشاء حساب ومساحة عمل</h1>
          <p className="mb-6 text-sm text-muted">دقيقة واحدة وتبدأ أول مناسبة — الباقة المجانية مفعلة تلقائيًا.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="اسمك" htmlFor="name">
              <Input id="name" value={form.name} onChange={set("name")} required placeholder="الاسم الكامل" />
            </Field>
            <Field label="البريد الإلكتروني" htmlFor="email" hint="أو رقم هاتف دولي — أحدهما يكفي">
              <Input id="email" type="email" dir="ltr" className="text-left" value={form.email} onChange={set("email")} placeholder="you@example.com" />
            </Field>
            <Field label="رقم الهاتف (اختياري)" htmlFor="phone">
              <Input id="phone" dir="ltr" className="text-left" value={form.phone} onChange={set("phone")} placeholder="+9665xxxxxxxx" />
            </Field>
            <Field label="كلمة المرور" htmlFor="password" hint="8 أحرف على الأقل">
              <Input id="password" type="password" dir="ltr" className="text-left" value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="نوع مساحة العمل" htmlFor="kind">
                <Select id="kind" value={form.orgKind} onChange={set("orgKind")}>
                  <option value="individual">فرد</option>
                  <option value="vendor">مورد خدمات (قاعة، ضيافة، تصوير…)</option>
                  <option value="company">مؤسسة</option>
                </Select>
              </Field>
              <Field label="اسم مساحة العمل" htmlFor="org">
                <Input id="org" value={form.orgName} onChange={set("orgName")} placeholder="مثال: مناسبات آل سعد" />
              </Field>
            </div>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="w-full" size="lg" loading={loading}>إنشاء الحساب والبدء</Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            عندك حساب؟ <Link href="/login" className="font-bold text-navy-950 underline decoration-lime-400 decoration-2 underline-offset-4">سجّل دخولك</Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs leading-6 text-ivory/40">
          بإنشائك الحساب فأنت تقر بأن بيانات المدعوين تُجمع بالحد الأدنى ولغرض الدعوة فقط،
          وفق سياسة الخصوصية المعتمدة قبل الإطلاق.
        </p>
      </div>
    </div>
  );
}
