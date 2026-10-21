/** @jest-environment node */

/**
 * Tests for the S3 prefix policy.
 *
 * This is the access-control boundary for S3 reads: it decides whether a key is
 * well-formed and what session a caller needs to reach it. It replaced per-route
 * inline checks that disagreed with each other — `/api/files` required a session
 * for `content/` while `/api/images` served the same prefix publicly.
 */

import {
  parsePathName,
  resolveS3Key,
  satisfiesAccessLevel,
  S3KeyError,
  S3_PREFIXES,
} from '../prefixes';

describe('S3_PREFIXES', () => {
  it('declares both read and write for every prefix', () => {
    for (const [name, policy] of Object.entries(S3_PREFIXES)) {
      expect(policy.prefix.endsWith('/')).toBe(true);
      expect(policy.read).toBeDefined();
      expect(policy.write).toBeDefined();
      expect(policy.description).toBeTruthy();
      expect(name).toBeTruthy();
    }
  });

  // The whole point of the change: content/ must not be world-readable, since
  // it is the default upload destination and accepts non-image files.
  it('keeps content/ authenticated, not public', () => {
    expect(S3_PREFIXES.content.read).toBe('authenticated');
  });

  it('is the only prefix that is publicly readable', () => {
    const publiclyReadable = Object.values(S3_PREFIXES)
      .filter((p) => p.read === 'public')
      .map((p) => p.prefix);
    expect(publiclyReadable).toEqual(['public/']);
  });

  it('requires admin to write anything publicly readable', () => {
    for (const policy of Object.values(S3_PREFIXES)) {
      if (policy.read === 'public') {
        expect(policy.write).toBe('admin');
      }
    }
  });
});

describe('parsePathName', () => {
  it.each(['public', 'content', 'mappTeam', 'temp'])('accepts %p', (name) => {
    expect(parsePathName(name)).toBe(name);
  });

  // Previously cast without checking, producing keys beginning "undefined".
  it.each([undefined, null, '', 'nope', '__proto__', 42, {}])(
    'rejects %p',
    (value) => {
      expect(() => parsePathName(value)).toThrow(S3KeyError);
    }
  );
});

describe('resolveS3Key', () => {
  it('accepts a well-formed key and returns its policy', () => {
    const { key, policy } = resolveS3Key('content/123-abc-file.pdf');
    expect(key).toBe('content/123-abc-file.pdf');
    expect(policy.read).toBe('authenticated');
  });

  it('resolves nested keys such as image variants', () => {
    const { policy } = resolveS3Key('content/variants/thumbnail/x.webp');
    expect(policy.prefix).toBe('content/');
  });

  it.each([
    ['', 'empty'],
    ['/content/x.png', 'leading slash'],
    ['secrets/x.png', 'undeclared prefix'],
    ['undefined123-x.png', 'the old undefined-prefix bug'],
    ['content/', 'names a folder, not an object'],
    ['content/../mapp-team/x.png', 'dot-dot segment'],
    ['content/./x.png', 'dot segment'],
    ['content//x.png', 'empty segment'],
    ['content/x\0.png', 'NUL byte'],
  ])('rejects %p (%s)', (key) => {
    expect(() => resolveS3Key(key)).toThrow(S3KeyError);
  });

  it('rejects a key that merely contains a valid prefix later on', () => {
    expect(() => resolveS3Key('evil/content/x.png')).toThrow(S3KeyError);
  });
});

describe('satisfiesAccessLevel', () => {
  it('ranks admin above authenticated above public', () => {
    expect(satisfiesAccessLevel('admin', 'authenticated')).toBe(true);
    expect(satisfiesAccessLevel('admin', 'public')).toBe(true);
    expect(satisfiesAccessLevel('authenticated', 'public')).toBe(true);
  });

  it('refuses to promote a weaker caller', () => {
    expect(satisfiesAccessLevel('public', 'authenticated')).toBe(false);
    expect(satisfiesAccessLevel('public', 'admin')).toBe(false);
    expect(satisfiesAccessLevel('authenticated', 'admin')).toBe(false);
  });

  it('accepts an exact match', () => {
    expect(satisfiesAccessLevel('authenticated', 'authenticated')).toBe(true);
  });
});
