import { NextRequest, NextResponse } from 'next/server';
import { S3ImageService } from '@/modules/s3_images';
import { authorizeS3Read } from '@/modules/s3_images/server/authorize';
import logger from '@/lib/utils/logger';

/**
 * GET /api/images/[...path] — presigned URLs for S3 objects.
 *
 * Access is decided by the prefix policy in
 * `src/modules/s3_images/config/prefixes.ts`, NOT here. This route used to
 * serve everything under `content/` with no authentication while
 * `/api/files/[...path]` required a session for the same prefix — so the file
 * route's checks were bypassable by asking for the same key here. Both routes
 * now resolve through the same policy.
 *
 * Note this route is deliberately outside the middleware matcher
 * (`src/proxy.ts`), so the authorization below is the only gate.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const s3Key = path.join('/');

    const auth = await authorizeS3Read(s3Key);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const presignedUrl = await S3ImageService.getInstance().getPresignedUrl(
      auth.key,
      3600
    );

    const response = NextResponse.json({
      url: presignedUrl,
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    // Only genuinely public objects may be cached by shared caches — a
    // presigned URL for a protected object must not land in a CDN.
    response.headers.set(
      'Cache-Control',
      auth.policy.read === 'public'
        ? 'public, max-age=900'
        : 'private, max-age=300'
    );
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;
  } catch (error) {
    logger.error('Failed to generate presigned URL for image:', error);
    return NextResponse.json(
      { error: 'Failed to generate image URL' },
      { status: 500 }
    );
  }
}
