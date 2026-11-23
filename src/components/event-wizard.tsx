"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarHeart, MapPin, Users, Check } from "lucide-react";
import { api } from "@/lib/client";
import { EVENT_TYPES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Field, Select, Switch, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "dawat:event-draft";
const STEPS = ["الأساسيات", "الموعد والمكان", "السعة والحصص"];

export function EventWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return {
      title: "", type: "wedding", host_name: "", description: "",
      starts_at: "", ends_at: "", timezone: "Asia/Riyadh",
      venue_name: "", venue_address: "", map_url: "", is_virtual: false, virtual_url: "",
      capacity: 100, quota_unit: "card", cancel_returns_quota: true, allow_reentry: false, rsvp_deadline: "",
    };
  });

  // حفظ تلقائي للمسودة محليًا
  React.useEffect(() => {
    if (open) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* ignore */ }
    }
  }, [form, open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const payload: any = {
        title: form.title, type: form.type, host_name: form.host_name || undefined,
        description: form.description || undefined,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        timezone: form.timezone,
        venue_name: form.venue_name || undefined, venue_address: form.venue_address || undefined,
        map_url: form.map_url || undefined, is_virtual: form.is_virtual, virtual_url: form.virtual_url || undefined,
        capacity: Number(form.capacity), quota_unit: form.quota_unit,
        cancel_returns_quota: form.cancel_returns_quota, allow_reentry: form.allow_reentry,
        rsvp_deadline: form.rsvp_deadline ? new Date(form.rsvp_deadline).toISOString() : null,
      };
      const ev = await api.post<any>("/api/events", payload);
      localStorage.removeItem(DRAFT_KEY);
      onClose();
      router.push(`/app/events/${ev.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  const canNext = step === 0 ? form.title.trim().length > 0 : true;

  return (
    <Dialog open={open} onClose={onClose} title="مناسبة جديدة" wide>
      {/* مؤشر الخطوات */}
      <div className="mb-6 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => i < step && setStep(i)}
              className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:text-xs",
                i === step ? "bg-navy-950 text-lime-400" : i < step ? "bg-lime-100 text-navy-950 cursor-pointer" : "bg-navy-950/5 text-muted")}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>} {s}
            </button>
            {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-navy-950/10 min-[420px]:block" />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4 animate-fade-in">
          <Field label="نوع المناسبة">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {EVENT_TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => set("type", t.id)}
                  className={cn("cursor-pointer rounded-xl border px-2 py-2.5 text-xs font-bold transition-all",
                    form.type === t.id ? "border-lime-500 bg-lime-100 text-navy-950" : "border-navy-950/10 bg-white text-muted hover:border-navy-950/30")}>
                  {t.ar}
                </button>
              ))}
            </div>
          </Field>
          <Field label="اسم المناسبة" htmlFor="ev-title">
            <Input id="ev-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: حفل زفاف عبدالله ونورة" />
          </Field>
          <Field label="صاحب المناسبة (اسم العرض)" htmlFor="ev-host">
            <Input id="ev-host" value={form.host_name} onChange={(e) => set("host_name", e.target.value)} placeholder="مثال: آل عبدالله" />
          </Field>
          <Field label="وصف قصير (اختياري)" htmlFor="ev-desc">
            <Textarea id="ev-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="يظهر في صفحة الدعوة…" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="البداية" htmlFor="ev-start" hint="التخزين UTC والعرض حسب المنطقة الزمنية">
              <Input id="ev-start" type="datetime-local" dir="ltr" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </Field>
            <Field label="النهاية (اختياري)" htmlFor="ev-end">
              <Input id="ev-end" type="datetime-local" dir="ltr" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </Field>
          </div>
          <Field label="المنطقة الزمنية" htmlFor="ev-tz">
            <Select id="ev-tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              <option value="Asia/Riyadh">الرياض (GMT+3)</option>
              <option value="Asia/Dubai">دبي (GMT+4)</option>
              <option value="Asia/Kuwait">الكويت (GMT+3)</option>
              <option value="Asia/Qatar">الدوحة (GMT+3)</option>
              <option value="Asia/Bahrain">المنامة (GMT+3)</option>
              <option value="Asia/Muscat">مسقط (GMT+4)</option>
              <option value="Africa/Cairo">القاهرة (GMT+2)</option>
              <option value="Asia/Amman">عمّان (GMT+3)</option>
            </Select>
          </Field>
          <Switch checked={form.is_virtual} onChange={(v) => set("is_virtual", v)} label="مناسبة افتراضية (عن بُعد)" />
          {form.is_virtual ? (
            <Field label="رابط الاجتماع" htmlFor="ev-vurl">
              <Input id="ev-vurl" dir="ltr" className="text-left" value={form.virtual_url} onChange={(e) => set("virtual_url", e.target.value)} placeholder="https://…" />
            </Field>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم المكان" htmlFor="ev-venue">
                  <Input id="ev-venue" value={form.venue_name} onChange={(e) => set("venue_name", e.target.value)} placeholder="قاعة / فندق / استراحة" />
                </Field>
                <Field label="العنوان" htmlFor="ev-addr">
                  <Input id="ev-addr" value={form.venue_address} onChange={(e) => set("venue_address", e.target.value)} placeholder="الحي، المدينة" />
                </Field>
              </div>
              <Field label="رابط الاتجاهات على الخرائط (اختياري)" htmlFor="ev-map">
                <Input id="ev-map" dir="ltr" className="text-left" value={form.map_url} onChange={(e) => set("map_url", e.target.value)} placeholder="https://maps.google.com/…" />
              </Field>
            </>
          )}
          <Field label="إغلاق الردود RSVP في (اختياري)" htmlFor="ev-deadline">
            <Input id="ev-deadline" type="datetime-local" dir="ltr" value={form.rsvp_deadline} onChange={(e) => set("rsvp_deadline", e.target.value)} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <Field label="السعة القصوى" htmlFor="ev-cap" hint="حسب وحدة الحصة المختارة أدناه">
            <Input id="ev-cap" type="number" min={1} dir="ltr" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
          </Field>
          <Field label="وحدة احتساب الحصة" hint="تُقفل بعد أول إصدار دعوة ولا تُبدّل إلا بترحيل محكوم">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "card", t: "بطاقة / دعوة", d: "كل دعوة تحجز وحدة واحدة مهما كان عدد المرافقين" },
                { id: "person", t: "شخص شامل المرافقين", d: "الحجز = المدعو + المرافقون المسموحون لفئته" },
              ].map((u) => (
                <button key={u.id} type="button" onClick={() => set("quota_unit", u.id)}
                  className={cn("cursor-pointer rounded-xl border p-3.5 text-right transition-all",
                    form.quota_unit === u.id ? "border-lime-500 bg-lime-100" : "border-navy-950/10 bg-white hover:border-navy-950/30")}>
                  <p className="text-sm font-bold">{u.t}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{u.d}</p>
                </button>
              ))}
            </div>
          </Field>
          <div className="rounded-xl border border-navy-950/8 bg-ivory-soft p-4">
            <Switch checked={form.cancel_returns_quota} onChange={(v) => set("cancel_returns_quota", v)} label="إعادة الحصة عند إلغاء الدعوة (وإلا تبقى مستهلكة)" />
            <Switch checked={form.allow_reentry} onChange={(v) => set("allow_reentry", v)} label="السماح بإعادة الدخول عند البوابة" />
          </div>
        </div>
      )}

      {error && <div className="mt-4"><ErrorState message={error} /></div>}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
          {step === 0 ? "إلغاء" : "السابق"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>التالي</Button>
        ) : (
          <Button onClick={submit} loading={saving}><CalendarHeart className="h-4.5 w-4.5" /> إنشاء المناسبة</Button>
        )}
      </div>
    </Dialog>
  );
}
