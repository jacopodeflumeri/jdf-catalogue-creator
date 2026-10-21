/**
 * Core feedback submission — writes one "pending" row to the shared Notion DB.
 *
 * No LLM is called here (or anywhere in the app): triage, categorization, and
 * the weekly digest are handled by a separate centralized Notion agent. This
 * keeps every app off the LLM-cost path and confines prompt-injection risk to
 * one controlled place. See docs/template/capabilities/USER_FEEDBACK.md.
 */
import { logger } from "@/lib/utils/logger";
import { getConfigFromEnv } from "./config";
import { sanitizeComment } from "./sanitize";
import {
  buildFeedbackProperties,
  createNotionClient,
  type FeedbackCategory,
} from "./notion";

const CATEGORIES: readonly FeedbackCategory[] = ["bug", "feature", "other"];

/** Thrown for bad user input — the route maps this to HTTP 400. */
export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackValidationError";
  }
}

export interface SubmitFeedbackParams {
  category: FeedbackCategory;
  /** Raw comment from the user; sanitized + capped here. */
  comment: string;
  /** Star rating; only meaningful for the "other" (general feedback) category. */
  rating: number | null;
  /** Auto-filled by the caller from the session. */
  userName: string;
  userEmail: string;
  /** Company/account name for company-context customers; null for internal users. */
  company: string | null;
}

/**
 * Validate, auto-fill, and persist a feedback entry to Notion.
 *
 * Rating rules: required (1–5) for general feedback ("other"); ignored for
 * "bug"/"feature", where "how many stars is this crash?" is meaningless — the
 * Notion Rating column is simply left empty.
 */
export async function submitFeedback(params: SubmitFeedbackParams): Promise<void> {
  const config = getConfigFromEnv();

  if (!CATEGORIES.includes(params.category)) {
    throw new FeedbackValidationError("Invalid category");
  }

  const comment = sanitizeComment(params.comment);
  if (comment.length === 0) {
    throw new FeedbackValidationError("Comment is required");
  }

  let rating: number | null = null;
  if (params.category === "other") {
    const r = params.rating;
    if (typeof r !== "number" || Number.isNaN(r) || r < 1 || r > 5) {
      throw new FeedbackValidationError("Rating must be between 1 and 5");
    }
    rating = Math.round(r);
  }

  const notion = createNotionClient(config.notionApiKey);

  await notion.pages.create({
    parent: { database_id: config.notionDatabaseId },
    properties: buildFeedbackProperties({
      appName: config.appName,
      responsiblePerson: config.responsiblePerson,
      category: params.category,
      comment,
      rating,
      userName: params.userName,
      userEmail: params.userEmail,
      company: params.company,
      submittedAt: new Date(),
    }),
  });

  logger.info("[user_feedback] Feedback submitted", {
    app: config.appName,
    category: params.category,
  });
}
