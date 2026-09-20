import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAccount } from "@/server/queries";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/domain";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getAccount();
  if (profile?.account_status !== "approved") return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return new NextResponse(null, { status: 404 });
  const db = await createClient();
  const { data } = await db
    .from("profile_photos")
    .select("storage_path")
    .eq("user_id", id)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const file = await db.storage.from("profile-photos").download(data.storage_path);
  if (file.error) return new NextResponse(null, { status: 404 });
  try {
    const image = await sharp(Buffer.from(await file.data.arrayBuffer()), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 415 });
  }
}
