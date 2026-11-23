"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, CalendarDays, Music4, BarChart3, ArrowLeft, ChevronLeft } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    icon: Sparkles,
    title: "ليلتنا",
    subtitle: "منصة متكاملة لتخطيط مناسبتك وتنظيمها",
    desc: "من أول فكرة حتى آخر ضيف — خطط، ميزانية، مهام، ودعوات في مكان واحد بكل بساطة.",
    bg: "from-[#FBF8F5] to-[#EDE9E6]",
    art: "🌴",
  },
  {
    icon: CalendarDays,
    title: "تخطيط متكامل",
    subtitle: "من الفكرة إلى التنفيذ",
    desc: "ميزانية ومصروفات ومدفوعات، قوائم تجهيز ومهام، موردون وعقود وجدول زمني واضح.",
    bg: "from-[#F6F1EC] to-[#E2D3C3]",
    art: "📋",
  },
  {
    icon: Music4,
    title: "دعوات متحركة",
    subtitle: "تُرسل لضيوفك بكل بساطة",
    desc: "قوالب راقية بنشيد مرخّص، تفويض بالحصص، مرافقون، وتأكيد حضور بضغطة واحدة.",
    bg: "from-[#FBF8F5] to-[#EDE9E6]",
    art: "💌",
  },
  {
    icon: BarChart3,
    title: "متابعة شاملة",
    subtitle: "في الميزانية والمهام والضيوف",
    desc: "دخول منظّم بالـ QR، إحصائيات مباشرة، وتقرير إغلاق يجمع المصروف والحضور.",
    bg: "from-[#F6F1EC] to-[#E2D3C3]",
    art: "📊",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [i, setI] = React.useState(0);
  const slide = SLIDES[i];

  function finish() {
    localStorage.setItem("laylatna:onboarding", "1");
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EDE9E6] px-4 py-8">
      <div className={cn("relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-gradient-to-b shadow-xl transition-all duration-500", slide.bg)}>
        <div className="flex items-center justify-between px-5 pt-5">
          <BrandMark size={34} className="text-[#C99A6B]" />
          <Link href="/login" className="text-xs font-bold text-[#8A7A70] hover:text-[#4A3B36]">تخطي</Link>
        </div>

        <div className="flex min-h-[26rem] flex-col items-center justify-center px-7 text-center">
          <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#C99A6B]/10" />
            <div className="absolute inset-5 rounded-full border border-[#C99A6B]/30" />
            <span className="text-6xl" aria-hidden>{slide.art}</span>
            <span className="absolute -bottom-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5A4A44] text-[#F6F1EC] shadow-lg">
              <slide.icon className="h-5.5 w-5.5" />
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-[#4A3B36]">{slide.title}</h1>
          <p className="mt-2 text-sm font-semibold text-[#C99A6B]">{slide.subtitle}</p>
          <p className="mt-4 text-sm leading-7 text-[#8A7A70]">{slide.desc}</p>
        </div>

        <div className="flex items-center justify-between px-7 pb-7">
          <div className="flex gap-1.5">
            {SLIDES.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`شاشة ${k + 1}`}
                className={cn("h-2 rounded-full transition-all duration-300", k === i ? "w-6 bg-[#C99A6B]" : "w-2 bg-[#C99A6B]/30")} />
            ))}
          </div>
          <Button onClick={() => (i === SLIDES.length - 1 ? finish() : setI(i + 1))} className="bg-[#5A4A44] text-[#FBF8F5] hover:bg-[#4A3B36]">
            {i === SLIDES.length - 1 ? "ابدأ الآن" : "التالي"}
            {i === SLIDES.length - 1 ? <ArrowLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-[#8A7A70]">ليلتنا — عربي أولًا، RTL، وخصوصية تامة</p>
    </div>
  );
}
