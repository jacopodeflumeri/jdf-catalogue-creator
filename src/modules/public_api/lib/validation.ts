/**
 * Public API Query Parameter Validation
 *
 * Uses Zod schemas to validate and parse query parameters,
 * returning structured field-level errors on failure.
 */

import { z } from "zod";
import { errorResponse, type FieldError } from "./response";

export { parseInclude } from "./include";

/**
 * Parse and validate search params against a Zod schema.
 *
 * Returns either the parsed data or a NextResponse error
 * with field-level validation details.
 */
export function parseQueryParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
):
  | { success: true; data: z.infer<T> }
  | { success: false; response: ReturnType<typeof errorResponse> } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);

  if (!result.success) {
    const fieldErrors: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return {
      success: false,
      response: errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        fieldErrors,
      ),
    };
  }

  return { success: true, data: result.data };
}
