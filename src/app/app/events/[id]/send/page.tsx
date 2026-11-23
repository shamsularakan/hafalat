"use client";
import * as React from "react";
import Link from "next/link";
import { Send, Copy, MessageCircle, Ban, Plus, Check, QrCode } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { statusTone, cn } from "@/lib/utils";
import { INVITATION_STATUS_AR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const DEFAULT_MESSAGE = "السلام عليكم {اسم_الضيف} 🌿\nنتشرف بدعوتكم لحضور «{اسم_المناسبة}».\nدعوتكم الخاصة مع التفاصيل وتأكيد الحضور:\n{رابط_الدعوة}\nحضوركم يكمل فرحتنا!";

export default function SendPage() {
  const { event, role } = useEvent();
  const { show, node } = useToast();
  const [invitations, setInvitations] = React.useState<any[] | null>(null);
  const [guests, setGuests] = React.useState<any[]>([]);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [message, setMessage] = React.useState(DEFAULT_MESSAGE);
  const [error, setError] = React.useState("");
  const [issuing, setIssuing] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);
  const [cancelling, setCancelling] = React.useState<any>(null);
  const [qr, setQr] = React.useState<any>(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const canIssue = ["published", "ongoing"].includes(event.status);

  const load = React.useCallback(() => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    Promise.all([
      api.get<any[]>(`/api/events/${event.id}/invitations${params}`),
      api.get<any[]>(`/api/events/${event.id}/guests`),
      api.get<any[]>("/api/message-templates").catch(() => []),
    ]).then(([inv, g, t]) => { setInvitations(inv); setGuests(g); setTemplates(t); })
      .catch((e) => setError(e.message));
  }, [event.id, statusFilter]);
  React.useEffect(load, [load]);

  const invitedGuestIds = new Set((invitations ?? []).filter((i) => !["cancelled", "expired"].includes(i.status)).map((i) => i.guest_id));
  const uninvited = guests.filter((g) => !invitedGuestIds.has(g.id));

  function renderMessage(inv: any) {
    return message
      .replaceAll("{اسم_الضيف}", inv.guest_name)
      .replaceAll("{رابط_الدعوة}", inv.url)
      .replaceAll("{اسم_المناسبة}", event.title);
  }

  async function share(inv: any, channel: "whatsapp_manual" | "link_copy") {
    const text = renderMessage(inv);
    try {
      if (channel === "whatsapp_manual") {
        const phone = inv.guest_phone?.replace("+", "");
        const href = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
          : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(href, "_blank", "noopener");
        await api.post(`/api/invitations/${inv.id}/delivery`, { channel }).catch(() => {});
        show("فُتح واتساب — سجلنا الإرسال اليدوي");
      } else {
        await navigator.clipboard.writeText(text);
        await api.post(`/api/invitations/${inv.id}/delivery`, { channel }).catch(() => {});
        show("تم نسخ نص الدعوة والرابط");
      }
      load();
    } catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">الإرسال والمشاركة</h2>
          <p className="text-sm text-muted">روابط خاصة غير قابلة للتخمين + QR. الإرسال اليدوي عبر واتساب في هذه النسخة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select className="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="تصفية بالحالة">
            <option value="">كل الحالات</option>
            {Object.entries(INVITATION_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Button onClick={() => setIssuing(true)} disabled={!canIssue || uninvited.length === 0}>
            <Plus className="h-4 w-4" /> إصدار دعوات ({uninvited.length})
          </Button>
        </div>
      </div>

      {!canIssue && (
        <Card className="border-brand-orange/40 bg-brand-orange/5 text-sm">
          المناسبة بحالة «{EVENT_STATUS_LABEL(event.status)}» — انشرها أولًا من <Link className="font-bold underline decoration-lime-400 decoration-2 underline-offset-4" href={`/app/events/${event.id}`}>نظرة عامة</Link> لتتمكن من إصدار الدعوات.
        </Card>
      )}

      {/* قالب الرسالة */}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">قالب نص الرسالة</p>
          {templates.length > 0 && (
            <Select className="w-52" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setMessage(t.body); }} defaultValue="">
              <option value="">القوالب المحفوظة…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
        </div>
        <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="mt-1.5 text-[11px] text-muted">المعاملات المتاحة: {"{اسم_الضيف}"} · {"{رابط_الدعوة}"} · {"{اسم_المناسبة}"} — معاينة قبل الإرسال متاحة لكل دعوة.</p>
      </Card>

      {!invitations ? <Loading /> : invitations.length === 0 ? (
        <EmptyState title="لم تصدر دعوات بعد" hint={canIssue ? "أصدر دعوات لضيوفك ثم شارك الروابط الخاصة بهم." : "انشر المناسبة أولًا لتتمكن من الإصدار."}
          action={canIssue && uninvited.length > 0 ? <Button onClick={() => setIssuing(true)}><Send className="h-4 w-4" /> إصدار الآن</Button> : undefined} />
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr><TH>الضيف</TH><TH>الحالة</TH><TH>المفوّض</TH><TH>محجوز</TH><TH>مشاركة</TH><TH /></tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-semibold">{inv.guest_name}</TD>
                  <TD><Badge tone={statusTone(inv.status)}>{INVITATION_STATUS_AR[inv.status as keyof typeof INVITATION_STATUS_AR] ?? inv.status}</Badge></TD>
                  <TD className="text-xs text-muted">{inv.delegate_name ?? "المالك"}</TD>
                  <TD className="text-xs tabular-nums">{inv.persons_reserved} {event.quota_unit === "card" ? "بطاقة" : "شخص"}</TD>
                  <TD>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="text-success" onClick={() => setPreview(inv)} aria-label="معاينة وإرسال واتساب"><MessageCircle className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => share(inv, "link_copy")} aria-label="نسخ الرابط"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setQr(inv)} aria-label="رمز QR"><QrCode className="h-4 w-4" /></Button>
                    </div>
                  </TD>
                  <TD>
                    {!["cancelled", "expired", "checked_in"].includes(inv.status) && (
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setCancelling(inv)}><Ban className="h-3.5 w-3.5" /> إلغاء</Button>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted">{invitations.length} دعوة ضمن نطاق صلاحيتك</p>
        </Card>
      )}

      {issuing && <IssueDialog guests={uninvited} onClose={() => setIssuing(false)} onDone={() => { setIssuing(false); load(); }} />}
      {preview && (
        <Dialog open onClose={() => setPreview(null)} title={`معاينة رسالة «${preview.guest_name}»`}>
          <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-ivory-soft p-4 font-sans text-sm leading-7">{renderMessage(preview)}</pre>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPreview(null)}>إغلاق</Button>
            <Button variant="outline" onClick={() => { share(preview, "link_copy"); }}><Copy className="h-4 w-4" /> نسخ</Button>
            <Button className="bg-success text-white hover:bg-success/90" onClick={() => { share(preview, "whatsapp_manual"); setPreview(null); }}>
              <MessageCircle className="h-4 w-4" /> فتح واتساب
            </Button>
          </div>
        </Dialog>
      )}
      {qr && (
        <Dialog open onClose={() => setQr(null)} title={`رمز دخول «${qr.guest_name}»`}>
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/i/${qr.token}/qr.svg?preview=1`} alt="QR" width={220} height={220} className="rounded-xl border border-navy-950/10" />
            <p className="text-center text-xs text-muted">الرابط فقط داخل الرمز — بلا بيانات شخصية. يمكن إبطاله بإلغاء الدعوة وإعادة إصدارها.</p>
            <Input readOnly dir="ltr" className="text-left text-xs" value={qr.url} onFocus={(e) => e.target.select()} />
          </div>
        </Dialog>
      )}
      {cancelling && <CancelDialog inv={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); show("تم إلغاء الدعوة"); load(); }} />}
    </div>
  );
}

function EVENT_STATUS_LABEL(s: string) {
  const map: Record<string, string> = { draft: "مسودة", ready: "جاهزة", published: "منشورة", ongoing: "جارية", ended: "منتهية", archived: "مؤرشفة", cancelled: "ملغاة" };
  return map[s] ?? s;
}

function IssueDialog({ guests, onClose, onDone }: { guests: any[]; onClose: () => void; onDone: () => void }) {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set(guests.map((g) => g.id)));
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState<{ ok: number; failed: { name: string; reason: string }[] } | null>(null);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function issue() {
    setBusy(true);
    let ok = 0;
    const failed: { name: string; reason: string }[] = [];
    for (const g of guests.filter((x) => selected.has(x.id))) {
      try {
        // مفتاح منع تكرار ثابت لكل ضيف يمنع حرق الحصة مرتين عند إعادة المحاولة
        await api.post(`/api/events/${event.id}/invitations`, { guest_id: g.id, idempotency_key: `issue-${g.id}` });
        ok++;
      } catch (e: any) {
        failed.push({ name: g.name, reason: e.message });
      }
    }
    setResults({ ok, failed });
    setBusy(false);
    if (ok > 0) show(`تم إصدار ${ok} دعوة`);
  }

  return (
    <Dialog open onClose={onClose} title="إصدار دعوات" wide>
      {node}
      {!results ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">اختر الضيوف ({selected.size}/{guests.length}). الإصدار ذرّي: يُخصم من الحصة والسعة داخل معاملة واحدة، ومفاتيح منع التكرار مفعلة.</p>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-navy-950/8 p-2">
            {guests.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-ivory-soft">
                <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} className="h-4 w-4 accent-lime-500" />
                <span className="font-semibold">{g.name}</span>
                <span className="text-xs text-muted">{g.group_name ?? ""}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setSelected(selected.size === guests.length ? new Set() : new Set(guests.map((g) => g.id)))}>
              {selected.size === guests.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>إغلاق</Button>
              <Button onClick={issue} loading={busy} disabled={selected.size === 0}><Send className="h-4 w-4" /> إصدار {selected.size} دعوة</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-success/10 p-4 text-center">
            <p className="text-2xl font-extrabold text-success">{results.ok}</p>
            <p className="text-sm text-muted">دعوة صدرت بنجاح</p>
          </div>
          {results.failed.length > 0 && (
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
              <p className="mb-2 text-sm font-bold text-danger">تعذر إصدار {results.failed.length}:</p>
              <ul className="space-y-1 text-xs text-muted">
                {results.failed.map((f, i) => <li key={i}><b>{f.name}</b>: {f.reason}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end"><Button onClick={onDone}>تم — عرض الدعوات</Button></div>
        </div>
      )}
    </Dialog>
  );
}

function CancelDialog({ inv, onClose, onDone }: { inv: any; onClose: () => void; onDone: () => void }) {
  const { event } = useEvent();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true); setError("");
    try {
      await api.post(`/api/invitations/${inv.id}/cancel`, { reason });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title={`إلغاء دعوة «${inv.guest_name}»`}>
      <div className="space-y-4">
        <p className="rounded-xl bg-ivory-soft p-3 text-xs leading-6 text-muted">
          سياسة المناسبة: {event.cancel_returns_quota ? "تعود الحصة للمفوّض عند الإلغاء" : "تبقى الحصة مستهلكة عند الإلغاء"}.
          يُلغى الرابط والرمز فورًا، ويوثق السبب في سجل التدقيق.
        </p>
        <Field label="سبب الإلغاء (إلزامي)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: اعتذار الضيف" /></Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>تراجع</Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason.trim()}>تأكيد الإلغاء</Button>
        </div>
      </div>
    </Dialog>
  );
}
