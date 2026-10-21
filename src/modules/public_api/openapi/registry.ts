/**
 * OpenAPI Schema Registry
 *
 * Foundation for registering Zod schemas as OpenAPI components.
 * Apps add their own schemas on top of this base.
 */

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  paginationMetaSchema,
  errorEnvelopeSchema,
} from "../schemas/common";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// Create the global registry
export const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// Security scheme
// ---------------------------------------------------------------------------

registry.registerComponent("securitySchemes", "apiKey", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
  description: "API key for authentication",
});

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

registry.register("PaginationMeta", paginationMetaSchema.openapi("PaginationMeta"));
registry.register("ErrorEnvelope", errorEnvelopeSchema.openapi("ErrorEnvelope"));
