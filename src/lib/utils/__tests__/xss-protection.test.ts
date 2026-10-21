/**
 * @jest-environment jsdom
 */
import {
  sanitizeHTMLServerSide,
  sanitizeURL,
  detectXSS,
  generateCSPNonce,
} from '../xss-protection';

// Mock logger
jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('XSS Protection Utils', () => {
  describe('sanitizeHTMLServerSide', () => {
    it('should remove script tags', () => {
      const html = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHTMLServerSide(html);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove inline event handlers', () => {
      const html = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeHTMLServerSide(html);
      
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    it('should remove javascript: protocol', () => {
      const html = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizeHTMLServerSide(html);
      
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: protocol', () => {
      const html = '<img src="data:text/html,<script>alert(1)</script>">';
      const result = sanitizeHTMLServerSide(html);
      
      expect(result).not.toContain('data:');
    });

    it('should remove vbscript: protocol', () => {
      const html = '<a href="vbscript:msgbox(1)">Link</a>';
      const result = sanitizeHTMLServerSide(html);
      
      expect(result).not.toContain('vbscript:');
    });

    it('should remove dangerous tags', () => {
      const dangerousTags = [
        '<iframe src="evil.com"></iframe>',
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
        '<form action="evil.com"></form>',
        '<input type="text">',
        '<textarea></textarea>',
        '<link rel="stylesheet" href="evil.css">',
        '<style>body{background:url("evil.com")}</style>',
      ];

      dangerousTags.forEach(tag => {
        const result = sanitizeHTMLServerSide(tag);
        expect(result).toBe('');
      });
    });

    it('should preserve safe HTML', () => {
      const safeHtml = '<p>This is <strong>safe</strong> content</p>';
      const result = sanitizeHTMLServerSide(safeHtml);
      
      expect(result).toContain('This is');
      expect(result).toContain('safe');
      expect(result).toContain('content');
    });

    it('should handle empty/null input', () => {
      expect(sanitizeHTMLServerSide('')).toBe('');
      expect(sanitizeHTMLServerSide(null as any)).toBe('');
      expect(sanitizeHTMLServerSide(undefined as any)).toBe('');
    });

    it('should remove nested dangerous tags', () => {
      const html = '<div><script><script>alert(1)</script></script></div>';
      const result = sanitizeHTMLServerSide(html);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should handle various event handler variations', () => {
      const handlers = [
        '<div onload="alert(1)"></div>',
        '<div onerror="alert(1)"></div>',
        '<div onmouseover="alert(1)"></div>',
        '<div onfocus="alert(1)"></div>',
        '<div onchange="alert(1)"></div>',
      ];

      handlers.forEach(html => {
        const result = sanitizeHTMLServerSide(html);
        expect(result).not.toContain('alert');
        expect(result).not.toMatch(/on\w+=/);
      });
    });
  });

  describe('sanitizeURL', () => {
    it('should allow http URLs', () => {
      const url = 'http://example.com';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should allow https URLs', () => {
      const url = 'https://example.com';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should allow mailto URLs', () => {
      const url = 'mailto:test@example.com';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should allow tel URLs', () => {
      const url = 'tel:+1234567890';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should allow anchor links', () => {
      const url = '#section';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should allow relative URLs', () => {
      const url = '/page/about';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should block javascript: protocol', () => {
      const url = 'javascript:alert(1)';
      const result = sanitizeURL(url);
      expect(result).toBe('');
    });

    it('should block data: protocol', () => {
      const url = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeURL(url);
      expect(result).toBe('');
    });

    it('should block vbscript: protocol', () => {
      const url = 'vbscript:msgbox(1)';
      const result = sanitizeURL(url);
      expect(result).toBe('');
    });

    it('should block file: protocol', () => {
      const url = 'file:///etc/passwd';
      const result = sanitizeURL(url);
      expect(result).toBe('');
    });

    it('should block ftp: protocol', () => {
      const url = 'ftp://example.com/file.txt';
      const result = sanitizeURL(url);
      expect(result).toBe('');
    });

    it('should handle case-insensitive protocols', () => {
      const urls = [
        'JAVASCRIPT:alert(1)',
        'JavaScript:alert(1)',
        'DATA:text/html,<script>alert(1)</script>',
      ];

      urls.forEach(url => {
        const result = sanitizeURL(url);
        expect(result).toBe('');
      });
    });

    it('should handle null/undefined input', () => {
      expect(sanitizeURL(null as any)).toBe('');
      expect(sanitizeURL(undefined as any)).toBe('');
      expect(sanitizeURL('')).toBe('');
    });

    it('should trim whitespace', () => {
      const url = '  https://example.com  ';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });
  });

  describe('detectXSS', () => {
    it('should detect script tags', () => {
      const content = '<script>alert("xss")</script>';
      expect(detectXSS(content)).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      const content = '<a href="javascript:alert(1)">Link</a>';
      expect(detectXSS(content)).toBe(true);
    });

    it('should detect inline event handlers', () => {
      const contents = [
        '<div onclick="alert(1)">Click</div>',
        '<img onerror="alert(1)">',
        '<body onload="alert(1)">',
      ];

      contents.forEach(content => {
        expect(detectXSS(content)).toBe(true);
      });
    });

    it('should detect iframe tags', () => {
      const content = '<iframe src="evil.com"></iframe>';
      expect(detectXSS(content)).toBe(true);
    });

    it('should detect object tags', () => {
      const content = '<object data="evil.swf"></object>';
      expect(detectXSS(content)).toBe(true);
    });

    it('should detect embed tags', () => {
      const content = '<embed src="evil.swf">';
      expect(detectXSS(content)).toBe(true);
    });

    it('should detect data: protocol', () => {
      const content = 'data:text/html,<script>alert(1)</script>';
      expect(detectXSS(content)).toBe(true);
    });

    it('should detect vbscript: protocol', () => {
      const content = 'vbscript:msgbox(1)';
      expect(detectXSS(content)).toBe(true);
    });

    it('should not detect safe content', () => {
      const safeContents = [
        '<p>This is safe content</p>',
        '<div>Hello World</div>',
        'Just plain text',
        '<a href="https://example.com">Safe link</a>',
      ];

      safeContents.forEach(content => {
        expect(detectXSS(content)).toBe(false);
      });
    });

    it('should handle null/undefined input', () => {
      expect(detectXSS(null as any)).toBe(false);
      expect(detectXSS(undefined as any)).toBe(false);
      expect(detectXSS('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const contents = [
        '<SCRIPT>alert(1)</SCRIPT>',
        '<Script>alert(1)</Script>',
        'JAVASCRIPT:alert(1)',
      ];

      contents.forEach(content => {
        expect(detectXSS(content)).toBe(true);
      });
    });
  });

  describe('generateCSPNonce', () => {
    it('should generate a nonce', () => {
      const nonce = generateCSPNonce();
      expect(nonce).toBeTruthy();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate different nonces', () => {
      const nonce1 = generateCSPNonce();
      const nonce2 = generateCSPNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate hexadecimal string in browser', () => {
      // Mock crypto for browser environment
      global.window = { crypto: { getRandomValues: jest.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }) } } as any;

      const nonce = generateCSPNonce();
      expect(nonce).toMatch(/^[0-9a-f]+$/);
      
      delete (global as any).window;
    });
  });
});
