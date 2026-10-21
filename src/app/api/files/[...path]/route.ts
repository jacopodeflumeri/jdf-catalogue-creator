import { NextRequest, NextResponse } from 'next/server';
import { S3ImageService } from '@/modules/s3_images';
import { authorizeS3Read } from '@/modules/s3_images/server/authorize';
import logger from '@/lib/utils/logger';

/**
 * GET /api/files/[...path] — presigned URLs for S3 objects, with download-
 * oriented response headers.
 *
 * Shares the prefix policy in `src/modules/s3_images/config/prefixes.ts` with
 * `/api/images/[...path]`. The two routes differ only in response headers now;
 * they can no longer disagree about who may read a prefix.
 *
 * The old executable-extension blocklist here has been dropped rather than
 * duplicated. It gave the appearance of protection while the sibling route
 * served the same keys unauthenticated with no such check, and uploads are
 * already gated by a MIME allowlist plus magic-byte verification
 * (`comprehensiveFileVerification`) — an allowlist at write time beats a
 * blocklist at read time.
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

    response.headers.set(
      'Cache-Control',
      auth.policy.read === 'public'
        ? 'public, max-age=900'
        : 'private, max-age=300'
    );
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'none'; object-src 'none';"
    );
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    logger.info('File access granted', {
      s3Key: auth.key,
      user: auth.session?.user?.email ?? 'anonymous',
      ip:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
    });

    return response;
  } catch (error) {
    logger.error('Failed to generate presigned URL for file:', error);
    return NextResponse.json(
      { error: 'Failed to generate file URL' },
      { status: 500 }
    );
  }
}
