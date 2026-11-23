import { route } from "@/lib/api";
import fs from "node:fs";
import { getDb } from "@/lib/db";
import { getAudioForGuestToken } from "@/server/services/media";

type P = { params: Promise<{ token: string }> };

/** بث الصوت للضيف الصالح فقط، مع دعم Range لتشغيل iOS/Android */
export const GET = route(async (req: Request, { params }: P) => {
  const { token } = await params;
  const { asset, full } = (await getAudioForGuestToken((await getDb()), token));
  const stat = fs.statSync(full);
  const range = req.headers.get("range");
  const mime = asset.mime === "application/octet-stream" ? "audio/mpeg" : asset.mime;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? parseInt(m[1]) : 0;
    const end = m?.[2] ? parseInt(m[2]) : stat.size - 1;
    const chunk = fs.readFileSync(full).subarray(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  const data = fs.readFileSync(full);
  return new Response(data, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
