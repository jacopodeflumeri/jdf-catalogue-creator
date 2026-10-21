/** @jest-environment node */

/**
 * Tests for comment sanitization.
 *
 * Verifies: control-char stripping (keeping tab/newline), invisible/bidi
 * stripping, newline normalization, and the hard length cap.
 */

import { sanitizeComment } from "../sanitize";
import { FEEDBACK_COMMENT_MAX_LENGTH } from "../config";

const ZWSP = String.fromCodePoint(0x200b); // zero-width space
const RLO = String.fromCodePoint(0x202e); // right-to-left override
const BOM = String.fromCodePoint(0xfeff); // zero-width no-break space
const BELL = String.fromCodePoint(0x07); // C0 control char

describe("sanitizeComment", () => {
  it("returns an empty string for non-string input", () => {
    expect(sanitizeComment(undefined as unknown as string)).toBe("");
    expect(sanitizeComment(null as unknown as string)).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeComment("  hello  ")).toBe("hello");
  });

  it("strips zero-width, bidi-override and BOM characters", () => {
    expect(sanitizeComment(`he${ZWSP}llo${BOM} wor${RLO}ld`)).toBe("hello world");
  });

  it("strips C0 control characters but keeps tab and newline", () => {
    expect(sanitizeComment(`a${BELL}b`)).toBe("ab");
    expect(sanitizeComment("line1\nline2\tend")).toBe("line1\nline2\tend");
  });

  it("collapses 3+ consecutive newlines to a blank line", () => {
    expect(sanitizeComment("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("normalizes CRLF to LF", () => {
    expect(sanitizeComment("a\r\nb")).toBe("a\nb");
  });

  it("hard-caps the length", () => {
    const long = "x".repeat(FEEDBACK_COMMENT_MAX_LENGTH + 500);
    expect(sanitizeComment(long)).toHaveLength(FEEDBACK_COMMENT_MAX_LENGTH);
  });

  it("leaves ordinary multi-line feedback intact", () => {
    const input = "The export button is broken.\nI clicked it twice.";
    expect(sanitizeComment(input)).toBe(input);
  });
});
