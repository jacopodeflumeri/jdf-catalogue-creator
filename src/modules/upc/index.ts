/**
 * UPC (Unified Product Catalog) Module
 *
 * API client for Mapp's Product Feed Service.
 * List feeds, stream products, and map feeds to workspaces.
 */

export {
  listFeeds,
  getFeedAttributes,
  getProductCount,
  getProductPage,
  getProductByVariantId,
  getFeedToWorkspaceMapping,
} from "./lib/client";

export { streamAllProducts } from "./lib/streaming";

export type {
  FeedDataType,
  ProductFeed,
  ProductAttribute,
  ProductFeedData,
  PaginatedProductFeedData,
  ProductFeedDataCount,
  UpcClientConfig,
  FeedWorkspaceMapping,
} from "./lib/types";
