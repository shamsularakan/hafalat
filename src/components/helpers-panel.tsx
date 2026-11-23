"use client";
/** الفزعة في «فريق التنظيم»: إضافة بالاسم والجوال والمهمة، طلب الفزعة عبر واتساب، وبطاقات الشكر بعد المناسبة */
import * as React from "react";
import { HandHeart, Plus, Trash2, Pencil, Send, Check, X, Clock, UserCheck, Gift } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";
import { ThanksCard } from "@/components/helper-cards";

const TASKS = ["الاستقبال", "استقبال النساء", "القهوة والضيافة", "تنظيم المواقف", "تنسيق الطاولات", "التصوير", "مرافقة كبار السن", "حفظ العبايات", "التنظيف بعد الحفل"];

const wa = (phone: string, text: string) => `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;

export function HelpersPanel() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<any>(null);
  const [thanksOpen, setThanksOpen] = React.useState(false);
  const load = React.useCallback(() => { api.get(`/api/events/${event.id}/helpers`).then(setData).catch((e) => setError(e.message)); }, [event.id]);
  React.useEffect(load, [load]);

  const host = event.host_name || "أهل المناسبة";
  const started = event.starts_at && Date.parse(event.starts_at) <= Date.now();

  async function sendRequest(h: any) {
    const text = `السلام عليكم ${h.name}،\n${host} يطلب فزعتك في «${event.title}»${event.starts_at ? ` يوم ${formatDateShort(event.starts_at, event.timezone)}` : ""}.${h.task ? `\nالمهمة: ${h.task}` : ""}\n\nالتفاصيل والرد:\n${h.link}`;
    window.open(wa(h.phone, text), "_blank", "noopener");
    await api.post(`/api/events/${event.id}/helpers/${h.id}/sent`, { kind: "request" }).catch(() => {});
    load();
  }
  async function sendThanks(h: any) {
    const text = `${h.name}، شكرًا من القلب على فزعتك في «${event.title}» 🤍\nبطاقة الشكر:\n${h.link}`;
    window.open(wa(h.phone, text), "_blank", "noopener");
    await api.post(`/api/events/${event.id}/helpers/${h.id}/sent`, { kind: "thanks" }).catch(() => {});
    load();
  }
  async function remove(h: any) {
    try { await api.del(`/api/events/${event.id}/helpers/${h.id}`); show("أُزيلت الفزعة"); load(); } catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const list = data.helpers;
  const accepted = list.filter((h: any) => h.status === "accepted").length;
  const thanked = list.filter((h: any) => h.thanked_at);
  const unsent = thanked.filter((h: any) => !h.thanks_sent_at);

  return (
    <Card>
      {node}
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2 text-sm"><HandHeart className="h-4.5 w-4.5 text-gold-500" /> الفزعة</CardTitle>
        <div className="flex flex-wrap gap-2">
          {started && list.length > 0 && <Button variant="outline" size="sm" onClick={() => setThanksOpen(true)}><Gift className="h-4 w-4" /> بطاقات الشكر</Button>}
          <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> إضافة فزعة</Button>
        </div>
      </CardHeader>
      <p className="mb-4 text-xs leading-6 text-muted">
        أهلك وأصدقاؤك الذين يساعدون يوم المناسبة. أضف الاسم والجوال والمهمة، ثم أرسل لهم طلب الفزعة على واتساب برابط شخصي يردّون منه.
        إن سجّل أحدهم في ليلتنا برقمه نفسه يجد فزعته في «فزعاتي». <b className="text-navy-950">عند انتهاء المناسبة تُصدر بطاقة شكر لكل من لم يعتذر تلقائيًا.</b>
      </p>
      {list.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge tone="neutral">{formatNumber(list.length)} فزعة</Badge>
          <Badge tone="success">{formatNumber(accepted)} قبلوا</Badge>
          {unsent.length > 0 && <Badge tone="warning">{formatNumber(unsent.length)} بطاقة شكر لم تُرسل</Badge>}
        </div>
      )}
      {list.length === 0 ? <p className="py-6 text-center text-sm text-muted">لم تُضف فزعة بعد.</p> : (
        <ul className="divide-y divide-navy-950/6">
          {list.map((h: any) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {h.name}
                  {h.status === "accepted" ? <Badge tone="success"><Check className="h-3 w-3" /> قبل</Badge>
                    : h.status === "declined" ? <Badge tone="neutral"><X className="h-3 w-3" /> اعتذر</Badge>
                    : <Badge tone="warning"><Clock className="h-3 w-3" /> {h.request_sent_at ? "بانتظار الرد" : "لم يُرسل له"}</Badge>}
                  {h.linked_account && <Badge tone="lime"><UserCheck className="h-3 w-3" /> له حساب</Badge>}
                </p>
                <p className="text-xs text-muted"><span dir="ltr">{h.phone}</span>{h.task ? ` · ${h.task}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {h.thanked_at ? (
                  <Button size="sm" variant={h.thanks_sent_at ? "outline" : "primary"} onClick={() => sendThanks(h)}>
                    <Gift className="h-4 w-4" /> {h.thanks_sent_at ? "أُرسلت — إعادة" : "إرسال بطاقة الشكر"}
                  </Button>
                ) : h.status !== "declined" && (
                  <Button size="sm" variant={h.request_sent_at ? "outline" : "primary"} onClick={() => sendRequest(h)}>
                    <Send className="h-4 w-4" /> {h.request_sent_at ? "إعادة الطلب" : "طلب الفزعة"}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setEditing(h)} aria-label={`تعديل ${h.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(h)} aria-label={`إزالة ${h.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <HelperDialog data={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("حُفظت الفزعة"); load(); }} />}
      {thanksOpen && (
        <ThanksDialog message={data.thanks_message} count={list.filter((h: any) => h.status !== "declined" && !h.thanked_at).length}
          onClose={() => setThanksOpen(false)} onDone={(n) => { setThanksOpen(false); show(n > 0 ? `أُصدرت ${formatNumber(n)} بطاقة شكر` : "حُفظ نص البطاقة"); load(); }} />
      )}
    </Card>
  );
}

function HelperDialog({ data, onClose, onSaved }: { data: any; onClose: () => void; onSaved: () => void }) {
  const { event } = useEvent();
  const [form, setForm] = React.useState({ name: data.name ?? "", phone: data.phone ?? "", task: data.task ?? "", notes: data.notes ?? "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save() {
    setBusy(true); setError("");
    try {
      if (data.id) await api.patch(`/api/events/${event.id}/helpers/${data.id}`, form);
      else await api.post(`/api/events/${event.id}/helpers`, form);
      onSaved();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل الفزعة" : "إضافة فزعة"}>
      <div className="space-y-4">
        <Field label="الاسم" htmlFor="h-name"><Input id="h-name" value={form.name} onChange={set("name")} placeholder="محمد العتيبي" /></Field>
        <Field label="رقم الجوال" htmlFor="h-phone" hint="بصيغة دولية — يُرسل عليه طلب الفزعة وبطاقة الشكر">
          <Input id="h-phone" dir="ltr" className="text-left" value={form.phone} onChange={set("phone")} placeholder="+9665…" />
        </Field>
        <Field label="المهمة" htmlFor="h-task">
          <Input id="h-task" list="helper-tasks" value={form.task} onChange={set("task")} placeholder="الاستقبال" />
          <datalist id="helper-tasks">{TASKS.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="ملاحظة له (اختياري)" htmlFor="h-notes"><Textarea id="h-notes" value={form.notes} onChange={set("notes")} placeholder="الحضور الساعة 6:30 مساءً عند البوابة الرئيسية" /></Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy} disabled={!form.name.trim() || !form.phone.trim()}>حفظ</Button></div>
      </div>
    </Dialog>
  );
}

function ThanksDialog({ message, count, onClose, onDone }: { message: string; count: number; onClose: () => void; onDone: (n: number) => void }) {
  const { event } = useEvent();
  const [text, setText] = React.useState(message);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const preview = text.split("{الاسم}").join("محمد").split("{المناسبة}").join(event.title);
  async function issue() {
    setBusy(true); setError("");
    try { const r = await api.post<any>(`/api/events/${event.id}/helpers/thanks`, { message: text }); onDone(r.issued); }
    catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="بطاقة الشكر للفزعة" wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="نص البطاقة" hint="{الاسم} و{المناسبة} يُستبدلان تلقائيًا لكل فزعة">
            <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <p className="text-xs leading-6 text-muted">
            {count > 0 ? `ستُصدر الآن ${formatNumber(count)} بطاقة لمن لم يعتذر ولم تصدر له بطاقة.` : "كل البطاقات صادرة — سيُحفظ النص الجديد ويظهر في البطاقات."}
            {" "}تظهر البطاقة على رابط كل فزعة وفي حسابه، وترسلها بضغطة عبر واتساب من القائمة.
          </p>
          {error && <ErrorState message={error} />}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={issue} loading={busy}><Gift className="h-4 w-4" /> {count > 0 ? "إصدار البطاقات" : "حفظ النص"}</Button></div>
        </div>
        <ThanksCard name="محمد" message={preview} from={event.host_name ?? ""} eventTitle={event.title} />
      </div>
    </Dialog>
  );
}
