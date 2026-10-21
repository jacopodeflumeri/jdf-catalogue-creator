/**
 * User Feedback capability — public API.
 *
 * A floating widget lets any authenticated user submit feedback, which is
 * written straight to a shared Notion database. The app makes NO LLM calls;
 * a centralized Notion agent handles triage, categorization, and the digest.
 *
 * The UI (widget + API route) ships as a copy-in scaffold under `scaffold/`.
 * See docs/template/capabilities/USER_FEEDBACK.md.
 */
export { submitFeedback, FeedbackValidationError } from "./lib/submit";
export type { SubmitFeedbackParams } from "./lib/submit";
export { sanitizeComment } from "./lib/sanitize";
export { FEEDBACK_COMMENT_MAX_LENGTH } from "./lib/config";
export type { FeedbackCategory } from "./lib/notion";
