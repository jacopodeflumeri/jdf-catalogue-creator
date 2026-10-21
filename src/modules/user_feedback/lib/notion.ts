/**
 * Notion is the system of record for feedback — there is no Prisma model.
 * This module builds the Notion page-property payload and the client.
 *
 * Column names below MUST match the shared "App Feedback" Notion database
 * exactly. See docs/template/capabilities/USER_FEEDBACK.md for the full schema.
 */
import { Client as NotionClient } from "@notionhq/client";

export type FeedbackCategory = "bug" | "feature" | "other";

/** Property payload type, derived from the Notion SDK so it stays in sync. */
type NotionCreateParams = Parameters<NotionClient["pages"]["create"]>[0];
type NotionProperties = NotionCreateParams["properties"];

export interface FeedbackPageInput {
  /** Stable app identifier ("App Name" column). */
  appName: string;
  /** App builder ("Responsible Person" column); omitted if empty. */
  responsiblePerson: string;
  category: FeedbackCategory;
  /** Already sanitized + length-capped. */
  comment: string;
  /** 1–5 for general feedback; null for bug/feature (Rating left empty). */
  rating: number | null;
  userName: string;
  /** Written to the "User Email" column; omitted if empty (Notion rejects ""). */
  userEmail: string;
  /** Company/account name for company-context customers; null for internal users. */
  company: string | null;
  submittedAt: Date;
}

/** Create a Notion client for the shared integration token. */
export function createNotionClient(apiKey: string): NotionClient {
  return new NotionClient({ auth: apiKey });
}

/**
 * Build the Notion page properties. Optional columns (Rating, User Email,
 * Responsible Person, Company) are only included when we actually have a value —
 * Notion's API rejects an empty `email`, and empty selects/text add noise.
 */
export function buildFeedbackProperties(input: FeedbackPageInput): NotionProperties {
  const reporter = input.userName || input.userEmail || "anonymous";
  const dateLabel = input.submittedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const properties: Record<string, unknown> = {
    "App Name": { rich_text: [{ text: { content: input.appName } }] },
    Title: { title: [{ text: { content: `Feedback from ${reporter} — ${dateLabel}` } }] },
    Comment: { rich_text: [{ text: { content: input.comment } }] },
    Category: { select: { name: input.category } },
    "User Name": { rich_text: [{ text: { content: input.userName } }] },
    "Submitted At": { date: { start: input.submittedAt.toISOString() } },
    "Triage Status": { select: { name: "pending" } },
  };

  if (input.rating != null) {
    properties["Rating"] = { number: input.rating };
  }
  if (input.userEmail) {
    properties["User Email"] = { email: input.userEmail };
  }
  if (input.responsiblePerson) {
    properties["Responsible Person"] = {
      rich_text: [{ text: { content: input.responsiblePerson } }],
    };
  }
  if (input.company) {
    properties["Company"] = { rich_text: [{ text: { content: input.company } }] };
  }

  return properties as NotionProperties;
}
