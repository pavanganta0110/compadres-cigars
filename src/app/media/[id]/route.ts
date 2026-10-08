import { MEDIA_ID } from "@/lib/domain/images";
import { serviceClient } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Public product/brand images. Ids are random UUIDs and never change, so responses are cached for a year. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!MEDIA_ID.test(id)) return new Response("Not found", { status: 404 });
  const { data } = await serviceClient().rpc("get_media", { p_id: id });
  const m = data as { content_type?: string; b64?: string } | null;
  if (!m?.b64 || !m.content_type) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m.b64, "base64"), {
    headers: {
      "Content-Type": m.content_type, "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "Content-Disposition": "inline",
    },
  });
}
