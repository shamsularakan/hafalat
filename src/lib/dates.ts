/** عرض التاريخ الهجري والميلادي — التخزين UTC دائمًا (القسم 04-B) */
export function formatDualDate(iso: string | null, timezone = "Asia/Riyadh"): { hijri: string; gregorian: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  try {
    const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric", timeZone: timezone,
    }).format(d);
    const gregorian = new Intl.DateTimeFormat("ar", {
      day: "numeric", month: "long", year: "numeric", timeZone: timezone, calendar: "gregory",
    }).format(d);
    const time = new Intl.DateTimeFormat("ar", {
      hour: "numeric", minute: "2-digit", timeZone: timezone,
    }).format(d);
    return { hijri, gregorian, time };
  } catch {
    return { hijri: "", gregorian: d.toLocaleDateString("ar"), time: d.toLocaleTimeString("ar") };
  }
}

export function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(opts: { title: string; description?: string; location?: string; start: string; end?: string; url?: string }): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LAYLATNA//AR//", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@dawat`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(opts.start)}`,
    `DTEND:${toIcsDate(opts.end ?? new Date(new Date(opts.start).getTime() + 4 * 3600e3).toISOString())}`,
    `SUMMARY:${(opts.title || "").replace(/[,;\n]/g, " ")}`,
    opts.description ? `DESCRIPTION:${opts.description.replace(/[,;\n]/g, " ")}` : "",
    opts.location ? `LOCATION:${opts.location.replace(/[,;\n]/g, " ")}` : "",
    opts.url ? `URL:${opts.url}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}
