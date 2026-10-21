/** @jest-environment node */

/**
 * Tests for the Notion property-payload builder.
 *
 * Verifies the auto-filled columns and, critically, that optional columns
 * (Rating, User Email, Responsible Person, Company) are omitted when empty —
 * Notion's API rejects an empty `email`, and blank selects/text add noise.
 */

import { buildFeedbackProperties, type FeedbackPageInput } from "../notion";

function baseInput(overrides: Partial<FeedbackPageInput> = {}): FeedbackPageInput {
  return {
    appName: "myapp",
    responsiblePerson: "Ada Builder",
    category: "bug",
    comment: "It broke",
    rating: null,
    userName: "Jane Doe",
    userEmail: "jane@mapp.com",
    company: null,
    submittedAt: new Date("2026-07-08T10:00:00Z"),
    ...overrides,
  };
}

// JSON round-trip so we can index the (heavily-unionized) Notion property type.
function props(input: FeedbackPageInput) {
  return JSON.parse(JSON.stringify(buildFeedbackProperties(input)));
}

describe("buildFeedbackProperties", () => {
  it("sets the always-present columns", () => {
    const p = props(baseInput());
    expect(p["App Name"].rich_text[0].text.content).toBe("myapp");
    expect(p.Comment.rich_text[0].text.content).toBe("It broke");
    expect(p.Category.select.name).toBe("bug");
    expect(p["User Name"].rich_text[0].text.content).toBe("Jane Doe");
    expect(p["Triage Status"].select.name).toBe("pending");
    expect(p["Submitted At"].date.start).toBe("2026-07-08T10:00:00.000Z");
  });

  it("builds a title from the reporter and date", () => {
    const p = props(baseInput());
    expect(p.Title.title[0].text.content).toContain("Feedback from Jane Doe");
  });

  it("falls back to the email in the title when no name", () => {
    const p = props(baseInput({ userName: "", userEmail: "jane@mapp.com" }));
    expect(p.Title.title[0].text.content).toContain("jane@mapp.com");
  });

  it("omits Rating when null and includes it when set", () => {
    expect(props(baseInput({ rating: null })).Rating).toBeUndefined();
    expect(props(baseInput({ rating: 4, category: "other" })).Rating.number).toBe(4);
  });

  it("omits User Email when empty", () => {
    expect(props(baseInput({ userEmail: "" }))["User Email"]).toBeUndefined();
    expect(props(baseInput())["User Email"].email).toBe("jane@mapp.com");
  });

  it("omits Responsible Person when empty", () => {
    expect(props(baseInput({ responsiblePerson: "" }))["Responsible Person"]).toBeUndefined();
    expect(props(baseInput())["Responsible Person"].rich_text[0].text.content).toBe("Ada Builder");
  });

  it("omits Company when null and includes it when present", () => {
    expect(props(baseInput({ company: null })).Company).toBeUndefined();
    expect(props(baseInput({ company: "Acme GmbH" })).Company.rich_text[0].text.content).toBe(
      "Acme GmbH",
    );
  });
});
