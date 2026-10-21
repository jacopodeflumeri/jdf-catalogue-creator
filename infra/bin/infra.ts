#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { readFileSync } from "fs";
import { resolve } from "path";
import { AppStack } from "../lib/stack";
import { getEnvironmentConfig } from "../lib/config/environments";

const app = new cdk.App();

// Read app identity from app.config.json
const appConfig = JSON.parse(
  readFileSync(resolve(__dirname, "../../app.config.json"), "utf-8"),
);

// Get environment from context or default to staging
const envName = app.node.tryGetContext("env") || "staging";
const config = getEnvironmentConfig(envName);
const shortEnv = envName === "production" ? "prod" : "stg";

// AWS environment
const awsEnv: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT || "936190502406",
  region: "eu-central-1",
};

new AppStack(app, `${config.appName}-${shortEnv}`, {
  env: awsEnv,
  config,
  description: [
    `${appConfig.displayName || config.appName} - ${envName}`,
    appConfig.createdBy ? `Created by: ${appConfig.createdBy}` : "",
    config.domainName ? `URL: https://${config.domainName}` : "",
  ]
    .filter(Boolean)
    .join(" | "),
});

// Cost-allocation tags, applied at the APP level (not per-stack) so that every
// stack synthesized here — including any additional stacks a project adds later
// (e.g. a dedicated database or search stack) — inherits them automatically.
//
// Scope: CDK only tags resources it CREATES. Imported/shared resources (the VPC,
// Transit Gateway, Route53 hosted zone, shared buckets) are never modified — so
// this never tags infrastructure shared across projects, which is intentional.
//
// For ECS Fargate, these also reach the running tasks via propagateTags /
// enableECSManagedTags on the service (see stack.ts). The tag KEYS must be
// activated as Cost Allocation Tags in the management/payer account before they
// surface in Cost Explorer / the CUR — see docs/template/COST_ALLOCATION.md.
const costAllocationTags: Record<string, string> = {
  Project: config.appName, // == APP_NAME == LiteLLM `app` (reconciliation key)
  Environment: envName, // staging | production — matches LiteLLM `environment`
  Product: config.product, // == APP_PRODUCT == LiteLLM product
  Team: appConfig.team || "",
  // AppOwner is the CURRENT budget holder and the key the monthly per-person
  // cost report groups on. CreatedBy records who originally scaffolded the app
  // and never changes; the two diverge as apps are handed over, which is why
  // this exists separately. Falls back to createdBy so a fork that has not set
  // it yet still attributes to somebody instead of dropping into "unattributed".
  //
  // Deliberately NOT named `Owner`: many resources in this account already carry
  // an AWS-set `Owner: AWSCloudFormation` (CloudFormation stamps it on ECS
  // clusters), which would swamp per-person grouping with a value we do not
  // control and cannot remove. AppOwner is unambiguous and ours.
  AppOwner: appConfig.appOwner || appConfig.createdBy || "",
  ManagedBy: appConfig.managedBy || "",
  CreatedBy: appConfig.createdBy || "",
};
for (const [key, value] of Object.entries(costAllocationTags)) {
  if (value) cdk.Tags.of(app).add(key, value); // skip empty values
}

// Warn — never fail — on identity tags that will not group cleanly in the cost
// report. A deploy must not break because someone's name is formatted oddly, but
// silent drift is exactly how `CreatedBy` ended up with three spellings of the
// same person. See docs/template/COST_ALLOCATION.md.
const ownerValue = costAllocationTags.AppOwner;
if (!ownerValue) {
  console.warn(
    "[cost-tags] WARNING: no `appOwner` in app.config.json — this app's spend " +
      "will show up as unattributed in the monthly cost report.",
  );
} else if (!/^[a-z]+\.[a-z]+$/.test(ownerValue)) {
  console.warn(
    `[cost-tags] WARNING: appOwner "${ownerValue}" is not in firstname.lastname ` +
      "form (lowercase, no email domain). It will need a manual alias entry to " +
      "be attributed to the right person.",
  );
}

app.synth();
