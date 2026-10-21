import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { S3ImageService } from "@/modules/s3_images";
import { authorizeS3Read } from "@/modules/s3_images/server/authorize";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stable, opaque public URL for generated catalog media only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  if (!UUID_PATTERN.test(publicId)) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  const asset = await prisma.syntheticImageAsset.findUnique({
    where: { publicId },
    select: { storageKey: true },
  });
  if (!asset?.storageKey || !asset.storageKey.startsWith("public/catalogs/")) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const auth = await authorizeS3Read(asset.storageKey);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = await S3ImageService.getInstance().getPresignedUrl(auth.key, 3600);
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "public, max-age=300");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
