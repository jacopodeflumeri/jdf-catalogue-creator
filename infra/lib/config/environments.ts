// =============================================================================
// Environment Configuration
// App identity is read from app.config.json (run scripts/setup.sh to configure)
// Adjust compute/database sizing below as needed
// =============================================================================

import { readFileSync } from "fs";
import { resolve } from "path";

const appConfig = JSON.parse(
  readFileSync(resolve(__dirname, "../../../app.config.json"), "utf-8"),
);
const APP_NAME: string = appConfig.appName;
// RDS databaseName only allows alphanumeric characters — sanitize hyphens
const DB_NAME: string = (appConfig.dbName || APP_NAME).replace(/-/g, "_");
// Mapp product line — billing/cost-allocation dimension. Mirrors the LiteLLM
// APP_PRODUCT so AWS spend and AI spend can both be sliced by product.
const APP_PRODUCT: string = appConfig.product || "internal";

export interface EnvironmentConfig {
  envName: "staging" | "production";

  // Application
  appName: string;
  dbName: string;
  // Mapp product line (fashion | engage | intelligence | internal | custom).
  // Drives the AWS `Product` tag and the container's APP_PRODUCT env var.
  product: string;

  // Domain
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;

  // VPC
  vpcId: string;

  // Network access — Mapp VPN/Office IPs for direct DB access
  mappVpnCidrs: string[];

  // Compute
  cpu: number;
  memoryMiB: number;
  desiredCount: number;
  minCapacity: number;
  maxCapacity: number;

  // Synthetic catalog generation spend guards
  catalogMaxProductsPerJob: number;
  catalogLargeJobThreshold: number;

  // Database
  dbInstanceClass: string;
  dbAllocatedStorage: number;
  dbBackupRetention: number;
  dbDeletionProtection: boolean;

  // Internal ALB (non-internet-facing, reachable via Transit Gateway)
  enableInternalAlb: boolean;
  internalAlbCidrs: string[];

  // S3
  s3BucketName: string;
  s3Prefix: string;

  // Observability — EventBridge rule that streams ECS task state changes to
  // CloudWatch Logs. Depends on the shared `labs-shared-observability` stack
  // (deployed once per AWS account+region from mapp-agentic-infra) for the
  // CloudWatch Logs resource policy. Flip to `false` as an emergency escape
  // hatch if that shared policy is not yet deployed in the target account.
  enableTaskStateLogging: boolean;
}

// =============================================================================
// Shared Mapp Labs AWS resources (do not change unless the account changes)
// =============================================================================
const baseConfig = {
  hostedZoneId: "Z03706141H2K96TGWE8I9",
  hostedZoneName: "labs.mapp.com",
  // Mapp VPN/Office IPs for direct database access
  mappVpnCidrs: ["195.140.184.24/32", "91.192.40.14/32", "91.192.40.15/32"],
  // Internal ALB — set to `true` ONLY if this app needs to receive traffic from
  // other Mapp services over the Transit Gateway (server-to-server, no public
  // internet). Most labs apps don't. Examples that DO need it: shared APIs
  // consumed by other labs apps, webhook receivers from internal Mapp infra.
  // Examples that DON'T: standalone customer/admin portals (the default).
  // Each enabled environment consumes 1 ALB against the regional ALB quota
  // (default 50/region in eu-central-1) — keep the default `false` unless you
  // have a concrete internal-network consumer.
  enableInternalAlb: false,
  internalAlbCidrs: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
  // EventBridge → CloudWatch Logs rule for ECS task state changes.
  // Requires `labs-shared-observability` stack to be deployed first.
  enableTaskStateLogging: true,
};

// =============================================================================
// Environment-specific configuration
// =============================================================================
export const environments: Record<string, EnvironmentConfig> = {
  staging: {
    ...baseConfig,
    envName: "staging",

    appName: APP_NAME,
    dbName: DB_NAME,
    product: APP_PRODUCT,
    domainName: `stg-${APP_NAME}.labs.mapp.com`,

    // VPC — MappLabs-Staging (Transit Gateway to internal Mapp services)
    vpcId: "vpc-093d8085c3684d09a",

    // Compute - minimal for cost savings
    cpu: 1024,
    memoryMiB: 2048,
    desiredCount: 1,
    minCapacity: 1,
    maxCapacity: 2,
    catalogMaxProductsPerJob: 100,
    catalogLargeJobThreshold: 25,

    // Database - t3.micro for cost savings
    dbInstanceClass: "t3.micro",
    dbAllocatedStorage: 20,
    dbBackupRetention: 0, // No backups for staging
    dbDeletionProtection: false,

    // S3
    s3BucketName: `mapp-labs-${APP_NAME}-staging`,
    s3Prefix: "",
  },

  production: {
    ...baseConfig,
    envName: "production",

    appName: APP_NAME,
    dbName: DB_NAME,
    product: APP_PRODUCT,
    domainName: `${APP_NAME}.labs.mapp.com`,

    // VPC — MappLabs-Production (Transit Gateway to internal Mapp services)
    vpcId: "vpc-0b8d0ded5bc6f647e",

    // Compute - larger for production
    cpu: 1024,
    memoryMiB: 2048,
    desiredCount: 1,
    minCapacity: 1,
    maxCapacity: 4,
    catalogMaxProductsPerJob: 100,
    catalogLargeJobThreshold: 25,

    // Database - t3.small for production with backups
    dbInstanceClass: "t3.small",
    dbAllocatedStorage: 20,
    dbBackupRetention: 7, // 7 days retention
    dbDeletionProtection: true,

    // S3
    s3BucketName: `mapp-labs-${APP_NAME}-prod`,
    s3Prefix: "",
  },
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) {
    throw new Error(
      `Unknown environment: ${envName}. Valid options: ${Object.keys(environments).join(", ")}`,
    );
  }
  return config;
}
