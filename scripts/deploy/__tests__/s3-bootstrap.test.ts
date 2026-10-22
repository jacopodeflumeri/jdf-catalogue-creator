import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const script = readFileSync(
  resolve(process.cwd(), "scripts", "deploy", "first-deploy.sh"),
  "utf8",
);

describe("first-deploy S3 bootstrap", () => {
  it("creates and secures the app-owned environment bucket before deployment", () => {
    expect(script).toContain('S3_BUCKET_NAME="mapp-labs-${APP_NAME}-prod"');
    expect(script).toContain('S3_BUCKET_NAME="mapp-labs-${APP_NAME}-staging"');
    expect(script).toContain("aws s3api head-bucket");
    expect(script).toContain("aws s3api create-bucket");
    expect(script).toContain("--object-ownership BucketOwnerEnforced");
    expect(script).toContain("aws s3api put-public-access-block");
    expect(script).toContain("aws s3api put-bucket-tagging");
  });
});
