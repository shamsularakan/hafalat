/** شعار ليلتنا: قوس + نخلة بأسلوب الهوية المعتمدة */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden className={className}>
      <path d="M10 68a30 30 0 0 1 60 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 64V34" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M40 34C31 22 20 22 13 29c9-2 17 2 23 9" fill="currentColor" />
      <path d="M40 34c9-12 20-12 27-5-9-2-17 2-23 9" fill="currentColor" />
      <path d="M40 32c-5-13 1-22 9-25-3 9-5 17-9 23" fill="currentColor" />
      <path d="M40 32c-7-10-16-12-23-8 7 3 14 8 19 14" fill="currentColor" />
      <path d="M40 38c7-9 16-9 21-4-7-1-13 2-17 7" fill="currentColor" opacity=".75" />
    </svg>
  );
}

export function Brand({
  size = 36, showLatin = true, className = "", tone = "gold",
}: {
  size?: number;
  showLatin?: boolean;
  className?: string;
  tone?: "gold" | "cream" | "brown";
}) {
  const color = tone === "cream" ? "#F6F1EC" : tone === "brown" ? "#5A4A44" : "#C99A6B";
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`} dir="rtl">
      <span style={{ color }}><BrandMark size={size} /></span>
      <span className="font-display mt-1 text-xl font-bold tracking-tight" style={{ color }}>ليلتنا</span>
      {showLatin && <span className="mt-0.5 text-[9px] font-semibold tracking-[0.3em]" style={{ color, opacity: 0.75 }} dir="ltr">LAYLATNA</span>}
    </span>
  );
}
