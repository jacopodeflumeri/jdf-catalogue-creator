/** @jest-environment node */

/**
 * Tests for the feedback submit path (validation + the single Notion write).
 * The Notion SDK and logger are mocked — no network, no real client.
 */

const mockCreate = jest.fn();

jest.mock("@notionhq/client", () => ({
  Client: jest.fn().mockImplementation(() => ({ pages: { create: mockCreate } })),
}));

jest.mock("@/lib/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() },
}));

import { submitFeedback, FeedbackValidationError, type SubmitFeedbackParams } from "../submit";
import type { FeedbackCategory } from "../notion";

function base(overrides: Partial<SubmitFeedbackParams> = {}): SubmitFeedbackParams {
  return {
    category: "bug",
    comment: "The export button is broken",
    rating: null,
    userName: "Jane Doe",
    userEmail: "jane@mapp.com",
    company: null,
    ...overrides,
  };
}

describe("submitFeedback", () => {
  beforeEach(() => {
    mockCreate.mockReset().mockResolvedValue({ id: "page_1" });
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_FEEDBACK_DATABASE_ID = "db_test";
  });

  it("rejects an invalid category without writing", async () => {
    await expect(
      submitFeedback(base({ category: "nope" as unknown as FeedbackCategory })),
    ).rejects.toBeInstanceOf(FeedbackValidationError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires a non-empty comment", async () => {
    await expect(submitFeedback(base({ comment: "   " }))).rejects.toBeInstanceOf(
      FeedbackValidationError,
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires a 1-5 rating for general feedback", async () => {
    await expect(
      submitFeedback(base({ category: "other", rating: null })),
    ).rejects.toBeInstanceOf(FeedbackValidationError);
    await expect(
      submitFeedback(base({ category: "other", rating: 6 })),
    ).rejects.toBeInstanceOf(FeedbackValidationError);
  });

  it("does not require a rating for bug/feature and leaves Rating empty", async () => {
    await submitFeedback(base({ category: "bug", rating: null }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.parent.database_id).toBe("db_test");
    expect(arg.properties.Rating).toBeUndefined();
    expect(arg.properties["Triage Status"].select.name).toBe("pending");
  });

  it("writes the rating for general feedback", async () => {
    await submitFeedback(base({ category: "other", rating: 4 }));
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.properties.Rating.number).toBe(4);
  });

  it("throws when the shared Notion secrets are missing", async () => {
    delete process.env.NOTION_API_KEY;
    await expect(submitFeedback(base())).rejects.toThrow(/NOTION_API_KEY/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
