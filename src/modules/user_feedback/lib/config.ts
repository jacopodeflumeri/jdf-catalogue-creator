/**
 * User Feedback — runtime configuration.
 *
 * Feedback rows are written directly to a shared Notion database (the system of
 * record). There is no Prisma model. Two secrets are needed, and because every
 * Labs app writes to the SAME Notion database, both are intended to live in a
 * SHARED SSM path (e.g. `/labs-shared/feedback/*`) rather than a per-app one —
 * see docs/template/capabilities/USER_FEEDBACK.md.
 *
 * `Responsible Person` and `App Name` are auto-filled from app.config.json so
 * feedback lands pre-attributed to the app and its builder without any user
 * input and without a second "ownership" lookup.
 */
import appConfig from "../../../../app.config.json";

/** Hard cap on stored comment length (also enforced client-side in the widget). */
export const FEEDBACK_COMMENT_MAX_LENGTH = 2000;

export interface FeedbackConfig {
  /** Notion integration token — shared across apps. */
  notionApiKey: string;
  /** Target Notion database id (the shared "App Feedback" DB). */
  notionDatabaseId: string;
  /** Stable per-app identifier written to the Notion "App Name" column. */
  appName: string;
  /** The app builder — written to "Responsible Person" at submit time. */
  responsiblePerson: string;
}

/**
 * Read + validate feedback config from the environment. Throws with a clear
 * message if the (shared) Notion secrets are missing, so a misconfigured app
 * fails loudly rather than silently dropping feedback.
 */
export function getConfigFromEnv(): FeedbackConfig {
  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_FEEDBACK_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error(
      "User feedback capability is enabled but not configured: set NOTION_API_KEY " +
        "and NOTION_FEEDBACK_DATABASE_ID (shared SSM: /labs-shared/feedback/*). " +
        "See docs/template/capabilities/USER_FEEDBACK.md.",
    );
  }

  // App slug is the stable, unique key the central Notion agent groups by.
  const appName =
    appConfig.appName || process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || "unknown";

  // The app builder owns incoming feedback; fall back to the maintainer.
  const responsiblePerson = (appConfig.createdBy || appConfig.managedBy || "").trim();

  return { notionApiKey, notionDatabaseId, appName, responsiblePerson };
}
