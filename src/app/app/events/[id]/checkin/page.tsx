"use client";
import * as React from "react";
import { QrCode, Users, DoorOpen, Hand, RefreshCw, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { QrScanner } from "@/components/qr-scanner";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Checkbox } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

interface ScanResult {
  ok: boolean; result: string; code?: string; message: string;
  guest_name?: string; persons?: number; override?: boolean;
}

export default function CheckinPage() {
  const { event, gates, role } = useEvent();
  const { show, node } = useToast();
  const [gateId, setGateId] = React.useState(gates[0]?.id ?? "");
  const [board, setBoard] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [last, setLast] = React.useState<ScanResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [manual, setManual] = React.useState(false);
  const [lastScanAt, setLastScanAt] = React.useState(0);

  const loadBoard = React.useCallback(() => {
    api.get(`/api/events/${event.id}/live`).then(setBoard).catch((e) => setError(e.message));
  }, [event.id]);

  // تحديث كل 20 ثانية (ضمن توصية 15–60 ثانية بالوثيقة)
  React.useEffect(() => {
    loadBoard();
    const t = setInterval(loadBoard, 20000);
    return () => clearInterval(t);
  }, [loadBoard]);

  async function doScan(token: string) {
    if (busy || Date.now() - lastScanAt < 1200) return;
    setBusy(true);
    setLastScanAt(Date.now());
    try {
      const res = await api.post<ScanResult>("/api/checkins/scan", {
        token, gate_id: gateId || null,
        idempotency_key: `scan-${token.slice(-12)}-${Math.floor(Date.now() / 3000)}`,
      });
      setLast(res);
      loadBoard();
    } catch (e: any) {
      setLast({ ok: false, result: "denied", message: e.message, code: e.code });
    }
    setBusy(false);
  }

  if (error) return <ErrorState message={error} onRetry={loadBoard} />;

  const open = ["published", "ongoing"].includes(event.status);

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><QrCode className="h-5 w-5 text-muted" /> الاستقبال والدخول</h2>
          <p className="text-sm text-muted">
            {open ? "المناسبة تستقبل الضيوف الآن" : `المناسبة بحالة «${event.status}» — المسح متاح فقط عند النشر/الجريان`}
            {event.allow_reentry ? " · إعادة الدخول مسموحة" : " · الدخول مرة واحدة"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-44" value={gateId} onChange={(e) => setGateId(e.target.value)} aria-label="البوابة">
            {gates.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Button variant="outline" onClick={() => setManual(true)}><Hand className="h-4 w-4" /> إدخال يدوي</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[24rem_1fr]">
        {/* الماسح + النتيجة */}
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <QrScanner onToken={doScan} active={open} />
          </Card>
          {last && (
            <div
              className={cn(
                "rounded-card p-5 text-center animate-pop",
                last.ok ? (last.result === "reentry" ? "bg-brand-orange text-white" : "bg-success text-white") : "bg-danger text-white"
              )}
              role="status"
            >
              <p className="text-3xl font-extrabold">{last.ok ? (last.result === "reentry" ? "إعادة دخول" : "✓ دخول") : "✕ مرفوض"}</p>
              <p className="mt-1.5 text-base font-bold">{last.guest_name ?? last.message}</p>
              {last.ok && last.persons && <p className="mt-0.5 text-sm opacity-90">{last.persons} أشخاص {last.override ? "(تجاوز يدوي موثق)" : ""}</p>}
              {!last.ok && <p className="mt-1 text-sm opacity-90">{last.message}{last.code ? ` (${last.code})` : ""}</p>}
            </div>
          )}
          {!open && (
            <Card className="border-brand-orange/40 bg-brand-orange/5 text-xs leading-6 text-muted">
              <AlertTriangle className="mb-1 h-4 w-4 text-brand-orange" />
              فعّل حالة «منشورة» أو «جارية» من نظرة عامة لبدء الاستقبال. التجاوزات اليدوية تتطلب سببًا وتوثق في التدقيق.
            </Card>
          )}
        </div>

        {/* اللوحة اللحظية */}
        <div className="min-w-0 space-y-4">
          {!board ? <Loading /> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="حضور فعلي" value={formatNumber(board.totals.actual_persons)} tone="navy" />
                <Stat label="بطاقات دخلت" value={formatNumber(board.totals.checked_in_cards)} tone="lime" />
                <Stat label="مؤكد" value={formatNumber(board.totals.confirmed)} tone="success" />
                <Stat label="متبقي من السعة" value={formatNumber(Math.max(0, event.capacity - (event.quota_unit === "card" ? board.totals.checked_in_cards : board.totals.actual_persons)))} />
              </div>
              <Card className="p-0">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm"><DoorOpen className="h-4 w-4" /> آخر عمليات الدخول</CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadBoard}><RefreshCw className="h-3.5 w-3.5" /> تحديث</Button>
                </CardHeader>
                {board.recent.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted">لا عمليات دخول بعد — امسح أول دعوة!</p>
                ) : (
                  <Table>
                    <thead><tr><TH>الضيف</TH><TH>أشخاص</TH><TH>البوابة</TH><TH>الموظف</TH><TH>الوقت</TH><TH>الوضع</TH></tr></thead>
                    <tbody>
                      {board.recent.map((c: any) => (
                        <TR key={c.id}>
                          <TD className="font-semibold">{c.guest_name}</TD>
                          <TD className="tabular-nums">{c.persons}</TD>
                          <TD className="text-xs text-muted">{c.gate_name ?? "—"}</TD>
                          <TD className="text-xs text-muted">{c.staff_name}</TD>
                          <TD className="text-xs text-muted">{formatDateShort(c.occurred_at)}</TD>
                          <TD>
                            <div className="flex gap-1">
                              {c.is_reentry ? <Badge tone="warning">إعادة</Badge> : null}
                              {c.mode === "manual" ? <Badge tone="navy">يدوي</Badge> : <Badge tone="success">مسح</Badge>}
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
                <p className="px-4 py-2 text-[11px] text-muted">تتحدث اللوحة تلقائيًا كل 20 ثانية.</p>
              </Card>
            </>
          )}
        </div>
      </div>

      {manual && <ManualDialog gateId={gateId} onClose={() => setManual(false)} onResult={(r) => { setLast(r); loadBoard(); }} />}
    </div>
  );
}

function ManualDialog({ gateId, onClose, onResult }: { gateId: string; onClose: () => void; onResult: (r: ScanResult) => void }) {
  const { event } = useEvent();
  const [invitations, setInvitations] = React.useState<any[]>([]);
  const [invId, setInvId] = React.useState("");
  const [persons, setPersons] = React.useState(1);
  const [reason, setReason] = React.useState("");
  const [override, setOverride] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    api.get<any[]>(`/api/events/${event.id}/invitations`).then(setInvitations).catch((e) => setError(e.message));
  }, [event.id]);

  async function submit() {
    setBusy(true); setError("");
    try {
      const res = await api.post<ScanResult>("/api/checkins/manual", {
        invitation_id: invId, gate_id: gateId || null, persons: Number(persons), reason, override,
      });
      onResult(res);
      onClose();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title="إجراء يدوي مبرر">
      <div className="space-y-4">
        <p className="rounded-xl bg-ivory-soft p-3 text-xs leading-6 text-muted">
          يُستخدم عند تعطل الكاميرا أو الاستثناءات. السبب إلزامي ويُسجل مع الموظف والوقت في سجل التدقيق.
          التجاوز يتخطى فحوص السعة/الاعتذار/الصلاحية عند تفعيله صراحةً.
        </p>
        <Field label="الدعوة">
          <Select value={invId} onChange={(e) => setInvId(e.target.value)}>
            <option value="">اختر ضيفًا…</option>
            {invitations.filter((i) => !["cancelled", "expired", "draft"].includes(i.status)).map((i) => (
              <option key={i.id} value={i.id}>{i.guest_name} — {i.status}</option>
            ))}
          </Select>
        </Field>
        <Field label="عدد الأشخاص"><Input type="number" min={1} dir="ltr" value={persons} onChange={(e) => setPersons(Number(e.target.value))} /></Field>
        <Field label="السبب (إلزامي)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تعطل كاميرا البوابة الشرقية" /></Field>
        <Checkbox checked={override} onChange={setOverride} label="تجاوز الفحوص (سعة/اعتذار/انتهاء) — استثناء موثق" />
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={busy} disabled={!invId || !reason.trim()}>تسجيل الدخول</Button>
        </div>
      </div>
    </Dialog>
  );
}
