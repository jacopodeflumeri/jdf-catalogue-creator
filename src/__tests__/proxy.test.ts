/** @jest-environment node */

/**
 * Tests for the Next.js 16 `proxy` file convention and the route-protection
 * matcher it carries.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`. The rename is
 * mechanical, but it is easy to half-apply during a retrofit — and the pieces
 * fail in different ways:
 *
 * - Leaving `src/middleware.ts` in place still *works* (Next 16 honours it and
 *   emits a deprecation warning), so nothing visibly breaks and the stale file
 *   can linger until the convention is removed outright.
 * - Leaving `experimental.middlewareClientMaxBodySize` in `next.config.ts` is
 *   silently ignored under the new key name, quietly reinstating the default
 *   body limit on a deployment that deliberately raised it.
 * - Leaving `--no-lint` on `next build` hard-fails the Docker build, because
 *   Next 16 removed the flag along with the build-time ESLint integration.
 *
 * These assertions pin all three so a partially-applied upgrade fails here
 * rather than in a deploy.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { config } from '@/proxy';

const repoRoot = join(__dirname, '..', '..');

// The read below is flagged by security/detect-non-literal-fs-filename for
// taking a non-literal path. The disable is deliberate: every caller passes a
// hard-coded repo-relative path (never user input), and the only operation is
// reading a checked-in config file inside this repo during a test run.
const read = (relativePath: string) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('proxy route-protection matcher', () => {
  it('protects the admin and account route trees, UI and API alike', () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        '/admin/:path*',
        '/account/:path*',
        '/api/admin/:path*',
        '/api/account/:path*',
      ])
    );
  });

  it('does not match /api/images, which authorizes itself', () => {
    // `/api/images/[...path]` is deliberately outside the matcher: it resolves
    // its own access level from the S3 prefix policy. If it were added here the
    // in-route check would become dead code and every read would require a
    // session, including the deliberately public `public/` prefix.
    expect(config.matcher).not.toEqual(
      expect.arrayContaining([expect.stringContaining('/api/images')])
    );
  });

  it('scopes every matcher entry to a path prefix rather than the whole app', () => {
    // A bare '/:path*' would put the auth proxy in front of static assets and
    // the sign-in page itself, which locks users out of the flow that fixes it.
    for (const entry of config.matcher) {
      expect(entry.startsWith('/')).toBe(true);
      expect(entry).not.toBe('/:path*');
    }
  });
});

describe('Next.js 16 proxy file convention', () => {
  it('defines the proxy at src/proxy.ts', () => {
    expect(existsSync(join(repoRoot, 'src', 'proxy.ts'))).toBe(true);
  });

  it('has no leftover src/middleware.ts from the Next 15 convention', () => {
    // Next 16 still honours this path with a deprecation warning, so a leftover
    // file does not fail the build — it just means the rename never finished.
    expect(existsSync(join(repoRoot, 'src', 'middleware.ts'))).toBe(false);
  });

  it('uses the renamed proxyClientMaxBodySize config key', () => {
    const nextConfig = read('next.config.ts');
    // Match the object-key form specifically. The old name legitimately appears
    // in a trailing comment explaining the rename, and that should not fail.
    expect(nextConfig).toMatch(/^\s*proxyClientMaxBodySize\s*:/m);
    expect(nextConfig).not.toMatch(/^\s*middlewareClientMaxBodySize\s*:/m);
  });
});

describe('Docker build command', () => {
  it('does not pass --no-lint, which Next 16 removed', () => {
    // `next build --no-lint` fails outright on Next 16 with
    // "error: unknown option '--no-lint'", breaking every image build.
    expect(read('Dockerfile')).not.toContain('--no-lint');
  });
});
