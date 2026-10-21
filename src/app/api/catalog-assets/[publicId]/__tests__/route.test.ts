/** @jest-environment node */

jest.mock("@/lib/prisma/client", () => ({
  prisma: { syntheticImageAsset: { findUnique: jest.fn() } },
}));
jest.mock("@/modules/s3_images", () => {
  const getPresignedUrl = jest.fn();
  return {
    S3ImageService: {
      getInstance: jest.fn(() => ({ getPresignedUrl })),
    },
    __getPresignedUrl: getPresignedUrl,
  };
});
jest.mock("@/modules/s3_images/server/authorize", () => ({
  authorizeS3Read: jest.fn(),
}));

import { prisma } from "@/lib/prisma/client";
import * as s3Images from "@/modules/s3_images";
import { authorizeS3Read as authorizeS3ReadFunction } from "@/modules/s3_images/server/authorize";
import { GET } from "../route";

const PUBLIC_ID = "f71da8c8-29a4-4b3b-8859-212627f25c45";
const findUnique = prisma.syntheticImageAsset.findUnique as jest.Mock;
const authorizeS3Read = authorizeS3ReadFunction as jest.Mock;
const getPresignedUrl = (s3Images as unknown as { __getPresignedUrl: jest.Mock })
  .__getPresignedUrl;

describe("catalog asset route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves one opaque catalog asset through the shared S3 authorization policy", async () => {
    const key = "public/catalogs/premium/PRE-W-000001-IVY/front.webp";
    findUnique.mockResolvedValue({ storageKey: key });
    authorizeS3Read.mockResolvedValue({
      ok: true,
      key,
      policy: { read: "public" },
      session: null,
    });
    getPresignedUrl.mockResolvedValue("https://signed.example.test/front.webp");

    const response = await GET(new Request("https://app.test"), {
      params: Promise.resolve({ publicId: PUBLIC_ID }),
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://signed.example.test/front.webp");
    expect(findUnique).toHaveBeenCalledWith({
      where: { publicId: PUBLIC_ID },
      select: { storageKey: true },
    });
    expect(authorizeS3Read).toHaveBeenCalledWith(key);
    expect(getPresignedUrl).toHaveBeenCalledWith(key, 3600);
  });

  it("does not query arbitrary IDs or serve keys outside generated catalogs", async () => {
    const malformed = await GET(new Request("https://app.test"), {
      params: Promise.resolve({ publicId: "../../secret" }),
    });
    expect(malformed.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();

    findUnique.mockResolvedValue({ storageKey: "public/unrelated.webp" });
    const unrelated = await GET(new Request("https://app.test"), {
      params: Promise.resolve({ publicId: PUBLIC_ID }),
    });
    expect(unrelated.status).toBe(404);
    expect(authorizeS3Read).not.toHaveBeenCalled();
  });
});
