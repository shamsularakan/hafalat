"use client";
import * as React from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** قارئ QR بالكاميرا — jsQR فوق getUserMedia، بلا رفع أي صور للخادم */
export function QrScanner({ onToken, active }: { onToken: (token: string) => void; active: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number>(0);
  const lastRef = React.useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const [error, setError] = React.useState("");
  const [running, setRunning] = React.useState(false);

  const stop = React.useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  const tick = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = (canvas.width = video.videoWidth);
    const h = (canvas.height = video.videoHeight);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || w === 0) { rafRef.current = requestAnimationFrame(tick); return; }
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
    if (code?.data) {
      let token = code.data.trim();
      const m = /\/i\/([A-Za-z0-9_-]{20,100})/.exec(token);
      if (m) token = m[1];
      const now = Date.now();
      // تهدئة 3 ثوانٍ لنفس الرمز لمنع المسح المتكرر غير المقصود
      if (token !== lastRef.current.token || now - lastRef.current.at > 3000) {
        lastRef.current = { token, at: now };
        if (navigator.vibrate) navigator.vibrate(80);
        onToken(token);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onToken]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "رفض المتصفح إذن الكاميرا — فعّله من إعدادات الموقع أو استخدم الإدخال اليدوي."
          : "تعذر تشغيل الكاميرا على هذا الجهاز — استخدم الإدخال اليدوي المبرر."
      );
    }
  }

  React.useEffect(() => {
    if (!active) stop();
    return stop;
  }, [active, stop]);

  return (
    <div className="space-y-3">
      <div className={cn("relative overflow-hidden rounded-card bg-navy-950", running ? "aspect-[4/3]" : "aspect-[4/3]")}>
        <video ref={videoRef} playsInline muted className={cn("h-full w-full object-cover", !running && "hidden")} />
        <canvas ref={canvasRef} className="hidden" />
        {running && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-52 w-52">
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-lime-400" />
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-lime-400" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-lime-400" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-lime-400" />
              <ScanLine className="absolute inset-x-0 top-1/2 mx-auto h-6 w-6 -translate-y-1/2 animate-pulse text-lime-400" />
            </div>
          </div>
        )}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ivory/70">
            <Camera className="h-10 w-10" />
            <p className="text-sm">وجّه كاميرا الجهاز نحو رمز الدعوة</p>
          </div>
        )}
      </div>
      {error && <p className="rounded-xl bg-danger/10 p-3 text-xs font-bold text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        {!running ? (
          <Button className="flex-1" onClick={start} disabled={!active}><Camera className="h-4.5 w-4.5" /> تشغيل الماسح</Button>
        ) : (
          <Button variant="danger" className="flex-1" onClick={stop}><CameraOff className="h-4.5 w-4.5" /> إيقاف الماسح</Button>
        )}
      </div>
    </div>
  );
}
