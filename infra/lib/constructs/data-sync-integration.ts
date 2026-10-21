import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface DataSyncIntegrationProps {
  /**
   * The ECS task role that will perform dumps/restores. IAM grants are
   * attached to this role.
   */
  taskRole: iam.IRole;

  /**
   * Slug used in the S3 key prefix: `config/{envSlug}/{appSlug}/`.
   * Defaults to the caller's `config.appName`. Must be <= 20 characters
   * to leave headroom for AWS resource naming (cluster names, log groups,
   * etc., often include a `labs-` or `${appSlug}-${env}` prefix).
   */
  appSlug: string;

  /**
   * Environment slug for the S3 key prefix. The data-sync convention is
   * `prod` / `staging` (not `prod` / `stg`, which the rest of this template
   * uses for ECS resource naming). The caller passes the slug explicitly
   * — this construct does not translate from `config.envName`.
   */
  envSlug: string;

  /**
   * SSM parameter name that holds the shared bucket name. Defaults to the
   * convention from the `mapp-labs-shared` template. Override only if your
   * account uses a different parameter path.
   */
  bucketNameParameter?: string;
}

/**
 * Wires the ECS task role for the shared `mapp-labs-data-sync` bucket:
 *
 *   - Write + abort multipart on `config/{envSlug}/{appSlug}/*` (own prefix)
 *   - List own prefix
 *   - Read + list any env's prefix for the same appSlug
 *     (`config/{*}/{appSlug}/*`) — both staging and prod can read each
 *     other's dumps for the same app, which is the typical refresh
 *     workflow.
 *
 * Per-app prefix isolation is enforced: no grants cross appSlug boundaries.
 *
 * This construct is purpose-built for dumping admin-editable config from
 * one environment so another can restore it. It is NOT a general-purpose
 * S3 capability — if the app needs public-facing S3 (assets, uploads,
 * exports), use a separate bucket and grant pattern.
 */
export class DataSyncIntegration extends Construct {
  /** The data-sync bucket name (resolved from SSM at deploy time). */
  public readonly bucketName: string;

  /** The data-sync bucket ARN. */
  public readonly bucketArn: string;

  /** The write prefix for this stack: `config/{envSlug}/{appSlug}/`. */
  public readonly keyPrefix: string;

  constructor(scope: Construct, id: string, props: DataSyncIntegrationProps) {
    super(scope, id);

    const {
      taskRole,
      appSlug,
      envSlug,
      bucketNameParameter = "/mapp-labs/shared/data-sync/bucket-name",
    } = props;

    if (!appSlug || appSlug.length > 20) {
      throw new Error(
        `DataSyncIntegration: appSlug must be 1-20 characters (got ${appSlug.length}: "${appSlug}"). ` +
          `AWS resource naming downstream (cluster names, log groups, prefixes) ` +
          `assumes short app slugs.`,
      );
    }
    if (!envSlug) {
      throw new Error("DataSyncIntegration: envSlug is required");
    }

    this.bucketName = ssm.StringParameter.valueForStringParameter(
      this,
      bucketNameParameter,
    );
    const bucket = s3.Bucket.fromBucketName(
      this,
      "Bucket",
      this.bucketName,
    );
    this.bucketArn = bucket.bucketArn;
    this.keyPrefix = `config/${envSlug}/${appSlug}/`;

    const ownPrefixPattern = `${this.keyPrefix}*`;
    const allEnvsForAppPattern = `config/*/${appSlug}/*`;

    // Write own prefix (PutObject + AbortMultipartUpload).
    bucket.grantPut(taskRole, ownPrefixPattern);
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["s3:AbortMultipartUpload"],
        resources: [`${bucket.bucketArn}/${ownPrefixPattern}`],
      }),
    );

    // Read any env's prefix for this app (covers both same-env reads and
    // cross-env reads, e.g., staging reading prod dumps).
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${bucket.bucketArn}/${allEnvsForAppPattern}`],
      }),
    );

    // List own prefix + any env's prefix for this app. ListBucket targets
    // the bucket itself with a prefix condition.
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [bucket.bucketArn],
        conditions: {
          StringLike: {
            "s3:prefix": [ownPrefixPattern, allEnvsForAppPattern],
          },
        },
      }),
    );

    new cdk.CfnOutput(this, "DataSyncBucketName", {
      value: this.bucketName,
      description: "Shared data-sync bucket name",
    });
    new cdk.CfnOutput(this, "DataSyncKeyPrefix", {
      value: this.keyPrefix,
      description: "This stack's data-sync write prefix",
    });
  }
}
