/**
 * UPC Product Streaming
 *
 * Async generator for memory-efficient iteration through all products
 * in a feed using keyset pagination.
 */

import logger from "@/lib/utils/logger";
import { getProductPage } from "./client";
import type { FeedDataType, ProductFeedData, UpcClientConfig } from "./types";

/**
 * Iterate through ALL products in a feed, handling pagination automatically.
 * Yields one page of products at a time.
 *
 * @example
 * ```typescript
 * for await (const batch of streamAllProducts(companyId, feedId)) {
 *   await processBatch(batch);
 * }
 * ```
 */
export async function* streamAllProducts(
  companyId: number,
  feedId: number,
  feedDataType: FeedDataType = "SOURCE",
  options?: { pageSize?: number },
  config?: UpcClientConfig,
): AsyncGenerator<ProductFeedData[]> {
  const pageSize = options?.pageSize ?? 500;
  let lastId: string | undefined;
  let pageNum = 0;

  while (true) {
    pageNum++;
    logger.info?.(
      `UPC: Fetching page ${pageNum} (feedId=${feedId}, lastId=${lastId ?? "start"})`,
    );

    const page = await getProductPage(
      companyId,
      feedId,
      feedDataType,
      { lastId, size: pageSize },
      config,
    );

    if (page.productViewPayloads.length > 0) {
      yield page.productViewPayloads;
    }

    if (!page.nextPageExists || !page.lastId) {
      break;
    }

    lastId = page.lastId;
  }

  logger.info?.(
    `UPC: Finished streaming feedId=${feedId}, ${pageNum} pages fetched`,
  );
}
