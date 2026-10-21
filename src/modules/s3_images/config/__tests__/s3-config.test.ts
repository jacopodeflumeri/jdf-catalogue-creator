/** @jest-environment node */

jest.mock("@/config/env", () => ({
  env: {
    S3_REGION: "eu-central-1",
    S3_BUCKET_NAME: "mapp-labs-catalogues-creator-staging",
    S3_ACCESS_KEY_ID: undefined,
    S3_SECRET_ACCESS_KEY: undefined,
    S3_MAX_FILE_SIZE: 100,
    CLOUDFRONT_DOMAIN: undefined,
  },
}));

import { validateS3Config } from "../s3-config";

describe("S3 configuration", () => {
  it("accepts region and bucket without static keys for the AWS credential chain", () => {
    expect(validateS3Config()).toEqual({ isValid: true, errors: [] });
  });
});
