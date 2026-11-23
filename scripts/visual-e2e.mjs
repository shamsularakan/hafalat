const base = "http://localhost:3000";
const email = `vis-${Date.now()}@example.com`;
let cookie = "";
async function call(method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const j = await r.json();
  if (!j.ok) throw new Error(`${method} ${path}: ${JSON.stringify(j.error)}`);
  return j.data;
}

const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
await call("POST", "/api/auth/register", { name: "مصمم", email, password: "Password123!", orgName: "منظمة بصرية" });
await call("POST", "/api/auth/login", { identifier: email, password: "Password123!" });
const starts = new Date(Date.now() + 7 * 864e5).toISOString();
const ev = await call("POST", "/api/events", { title: "حفل زفاف نورة وعبدالله", type: "wedding", capacity: 50, quota_unit: "card", starts_at: starts, ends_at: new Date(Date.parse(starts) + 4 * 3600e3).toISOString(), venue_name: "قاعة المملكة", venue_address: "الرياض" });
await call("POST", `/api/events/${ev.id}/timeline`, { title: "الاستقبال", phase: "event_day", starts_at: starts, sort_order: 1 });
await call("POST", `/api/events/${ev.id}/timeline`, { title: "حفل الزفاف", phase: "event_day", starts_at: new Date(Date.parse(starts) + 3600e3).toISOString(), sort_order: 2 });
const schema = {
  template_style: "editorial",
  palette: { bg: "#FBF8F5", card: "#F4EFE4", primary: "#4F6B5F", accent: "#B3975F", text: "#4A3B36", muted: "#8A7A70" },
  motion: "fade",
  cover: { title: "ليلتنا", subtitle: "بسم الله الرحمن الرحيم", hosts: "", ornament: "✦" },
  details: {
    message: "", venue_label: "المكان", date_label: "الموعد", rsvp_note: "",
    program: "", dress_code: "رسمي — بدلة / فستان سهرة", transport: "باص من القاعة ١٠ مساءً",
    accommodation: "فندق الرياض للضيوف", quote: "الحب ما يعرف حدود",
    photo_url: img, rsvp_phone: "0551234567", monogram: "ع | ن",
    groom: "عبدالله", bride: "نورة", invitation_line: "يتشرفان بدعوتكم لحضور حفل زفافهما",
  },
  show_countdown: false, show_qr: true,
  scenes: [
    { id: "ed-cover", kind: "cover", title: "الغلاف", motion: "fade", layers: [] },
    { id: "ed-welcome", kind: "welcome", title: "الترحيب", motion: "fade", layers: [] },
    { id: "ed-details", kind: "details", title: "البرنامج", motion: "fade", layers: [] },
    { id: "ed-rsvp", kind: "rsvp", title: "تأكيد الحضور", motion: "fade", layers: [] },
    { id: "ed-ticket", kind: "ticket", title: "التذكرة", motion: "fade", layers: [] },
  ],
};
await call("POST", `/api/events/${ev.id}/status`, { status: "ready" });
await call("POST", `/api/events/${ev.id}/status`, { status: "published" });
await call("PUT", `/api/events/${ev.id}/design`, { schema, state: "published" });
const guest = await call("POST", `/api/events/${ev.id}/guests`, { name: "ضيف الشرف", phone: "+966550000123" });
const inv = await call("POST", `/api/events/${ev.id}/invitations`, { guest_id: guest.id });
console.log(JSON.stringify({ ok: true, event: ev.id, token: inv.token, guestPage: `/i/${inv.token}` }));
