/**
 * OpenAPI Spec Generator
 *
 * Generates and caches the OpenAPI 3.1 document from the registry.
 * Unlike FTL which hardcodes the title, this accepts configuration.
 */

import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

let cachedSpec: Record<string, unknown> | null = null;

export interface OpenApiSpecOptions {
  title?: string;
  version?: string;
  description?: string;
}

export function generateOpenApiSpec(
  options?: OpenApiSpecOptions,
): Record<string, unknown> {
  // Only cache if using default options
  if (!options && cachedSpec) return cachedSpec;

  const generator = new OpenApiGeneratorV31(registry.definitions);

  const spec = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: options?.title ?? "API",
      version: options?.version ?? "1.0.0",
      description:
        options?.description ??
        "API documentation. Authenticate with an API key via the X-API-Key header.",
    },
    servers: [{ url: "/" }],
    security: [{ apiKey: [] }],
  }) as unknown as Record<string, unknown>;

  if (!options) cachedSpec = spec;

  return spec;
}

/**
 * Generate an HTML page that renders Swagger UI for the given spec URL.
 */
export function generateSwaggerHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
}
