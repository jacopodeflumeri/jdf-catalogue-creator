/** @jest-environment node */

import {
  buildGeneratedImageStorageKey,
  S3GeneratedAssetStorage,
} from "../generated-asset-storage";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("generated asset storage", () => {
  it("builds deterministic keys only from validated catalog identifiers", () => {
    expect(buildGeneratedImageStorageKey("premium-apparel", "PRE-W-000001-IVY", "FRONT")).toBe(
      "public/catalogs/premium-apparel/PRE-W-000001-IVY/front.webp",
    );
    expect(buildGeneratedImageStorageKey("premium-apparel", "PRE-W-000001-IVY", "ON_MODEL")).toBe(
      "public/catalogs/premium-apparel/PRE-W-000001-IVY/model.webp",
    );
    expect(() => buildGeneratedImageStorageKey("../premium", "PRE-W-000001-IVY", "FRONT")).toThrow(
      "not safe",
    );
  });

  it("normalizes images to WebP and returns an opaque stable app URL", async () => {
    const objects = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectBuffer: jest.fn(),
    };
    const storage = new S3GeneratedAssetStorage(objects, "https://catalogs.example.test");
    const stored = await storage.put({
      catalogSlug: "premium-apparel",
      styleExternalId: "PRE-W-000001-IVY",
      role: "FRONT",
      assetPublicId: "f71da8c8-29a4-4b3b-8859-212627f25c45",
      data: ONE_PIXEL_PNG,
      sourceMimeType: "image/png",
    });
    expect(stored).toEqual({
      storageKey: "public/catalogs/premium-apparel/PRE-W-000001-IVY/front.webp",
      mimeType: "image/webp",
      width: 1,
      height: 1,
      publicUrl: "https://catalogs.example.test/api/catalog-assets/f71da8c8-29a4-4b3b-8859-212627f25c45",
    });
    expect(objects.putObject).toHaveBeenCalledWith(
      stored.storageKey,
      expect.any(Buffer),
      "image/webp",
      expect.objectContaining({ role: "FRONT", asset: "f71da8c8-29a4-4b3b-8859-212627f25c45" }),
    );
  });
});
