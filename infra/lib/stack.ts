import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as logs from "aws-cdk-lib/aws-logs";
import * as events from "aws-cdk-lib/aws-events";
import * as s3 from "aws-cdk-lib/aws-s3";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Construct } from "constructs";
import { EnvironmentConfig } from "./config/environments";

// Single source of truth for the deployed image tag. `build-and-push.sh`,
// `deploy-app.sh`, and this stack all derive the immutable tag the same way —
// `${envName}-${version}` — from package.json's version, so they never disagree
// and nothing has to be threaded through CDK context / env / SSM. See the
// 2026-07-10 MIGRATION.md entry.
const APP_VERSION: string = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf-8"),
).version;

// Deploy-model toggle — the SINGLE source of truth this stack and
// `scripts/deploy/deploy-app.sh` (via _config.sh) both read from app.config.json,
// so they never disagree about which image tag the task def references.
//
//   false / absent (DEFAULT): the task def tracks the FLOATING `${envName}-latest`
//     tag, and `deploy-app.sh` deploys via `update-service --force-new-deployment`.
//     This path needs NO iam:PassRole, so the standard labs deploy identity
//     (labs-power → AWSReservedSSO_PowerUserAccess, which denies all iam:*) works.
//
//   true (OPT-IN): the task def pins the IMMUTABLE `${envName}-${APP_VERSION}`
//     tag, and `deploy-app.sh` registers a new task-def revision per deploy
//     (immutability + tag-pinned rollbacks). That flow calls
//     register-task-definition, which requires iam:PassRole on the app's ECS
//     task and execution roles — a permission PowerUserAccess does NOT grant.
//     Only enable this if your deployer (e.g. a dedicated CI role) holds it.
//
// See the 2026-07-11 MIGRATION.md entry and docs/template/DEPLOYMENT.md.
const IMMUTABLE_DEPLOY: boolean =
  JSON.parse(readFileSync(resolve(__dirname, "../../app.config.json"), "utf-8"))
    .immutableDeploy === true;

export interface AppStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { config } = props;
    const shortEnv = config.envName === "production" ? "prod" : "stg";
    const prefix = `${config.appName}-${shortEnv}`;

    // Shared SSM namespace. Values here are provisioned once per environment and
    // read by every Labs app — apps reference them directly rather than copying
    // them into `/${prefix}/*`, so a rotation or a moved host is a single write
    // plus a service restart, not a per-app SSM edit. Read-only for apps: never
    // write to `/mapp-labs*` from an app stack or deploy script.
    //
    // PER-ENVIRONMENT. Internal Mapp services are deployed per environment: INT
    // (`k8s-int-01`, Keycloak realm `s2s` on `idp-int.shortest-route.com`) and
    // PROD (`k8s-prod-01`, realm `s2s` on `auth.shortest-route.com`). The `s2s`
    // client id is the same (`mapp-labs`) but the secret differs per realm, so a
    // production credential returns `unauthorized_client` against INT. Staging
    // apps must therefore read INT values, never production ones — a staging app
    // pointed at `/mapp-labs/*` silently reads PRODUCTION company data.
    //
    // Production keeps the original unsuffixed prefix so existing prod apps are
    // unaffected; every other environment gets `/mapp-labs-${shortEnv}`.
    // See docs/template/INTERNAL-API.md.
    const sharedSsm =
      shortEnv === "prod" ? "/mapp-labs" : `/mapp-labs-${shortEnv}`;

    // =========================================================================
    // Import existing VPC
    // =========================================================================
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId: config.vpcId,
    });

    // =========================================================================
    // Import existing Route53 Hosted Zone
    // =========================================================================
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: config.hostedZoneId,
        zoneName: config.hostedZoneName,
      },
    );

    // =========================================================================
    // ACM Certificate
    // =========================================================================
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: config.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // =========================================================================
    // Security Groups
    // =========================================================================
    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: `ALB security group for ${prefix}`,
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS",
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP for redirect",
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "EcsSecurityGroup", {
      vpc,
      description: `ECS security group for ${prefix}`,
      allowAllOutbound: true,
    });
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      "Allow traffic from ALB",
    );

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: `RDS security group for ${prefix}`,
      allowAllOutbound: false,
    });
    dbSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow PostgreSQL from ECS",
    );
    // Allow from Mapp VPN/Office IPs for direct database access
    for (const cidr of config.mappVpnCidrs) {
      dbSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(cidr),
        ec2.Port.tcp(5432),
        `Allow PostgreSQL from Mapp VPN/Office (${cidr})`,
      );
    }

    // =========================================================================
    // RDS PostgreSQL Database
    // =========================================================================
    const dbCredentialsSecret = new rds.DatabaseSecret(this, "DbCredentials", {
      secretName: `${prefix}/db-credentials`,
      username: "postgres",
    });

    const database = new rds.DatabaseInstance(this, "Database", {
      databaseName: config.dbName,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of("17.7", "17"),
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        config.dbInstanceClass === "t3.micro"
          ? ec2.InstanceSize.MICRO
          : ec2.InstanceSize.SMALL,
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      allocatedStorage: config.dbAllocatedStorage,
      maxAllocatedStorage: config.dbAllocatedStorage * 2,
      // gp3, always. CDK's default is gp2, and at the sizes labs apps run
      // (20 GiB) gp2 gives a baseline of just 100 IOPS — 3 IOPS/GiB with a
      // 100 IOPS floor — and leans on a burst credit balance to reach 3,000.
      // A migration or a seed can drain that balance and drop the database to
      // 100 IOPS with no warning. gp3 gives a flat 3,000 IOPS / 125 MiB/s with
      // no credits, at the same per-GiB price on RDS. Do NOT add `iops` or
      // `storageThroughput`: below 400 GiB gp3 has no provisionable range, and
      // passing them makes RDS reject the modification.
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      backupRetention: cdk.Duration.days(config.dbBackupRetention),
      deletionProtection: config.dbDeletionProtection,
      removalPolicy:
        config.envName === "production"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      publiclyAccessible: false,
    });

    // =========================================================================
    // ECR Repository (shared across environments - import existing)
    // =========================================================================
    const ecrRepository = ecr.Repository.fromRepositoryName(
      this,
      "EcrRepository",
      config.appName,
    );

    // =========================================================================
    // ECS Cluster
    // =========================================================================
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: prefix,
      containerInsights: config.envName === "production",
    });

    // =========================================================================
    // Import existing S3 bucket
    // =========================================================================
    const s3Bucket = s3.Bucket.fromBucketName(
      this,
      "AppDataBucket",
      config.s3BucketName,
    );

    // =========================================================================
    // ECS Task Definition
    // =========================================================================
    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: `ECS task role for ${prefix}`,
    });

    // S3 permissions
    if (config.s3Prefix) {
      s3Bucket.grantReadWrite(taskRole, `${config.s3Prefix}*`);
    } else {
      s3Bucket.grantReadWrite(taskRole);
    }

    // SSM Parameter Store permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/${prefix}/*`,
        ],
      }),
    );

    const executionRole = new iam.Role(this, "ExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
    });

    // Allow execution role to pull from ECR and read secrets
    ecrRepository.grantPull(executionRole);
    dbCredentialsSecret.grantRead(executionRole);

    // Allow reading SSM parameters for secrets
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/${prefix}/*`,
        ],
      }),
    );

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        memoryLimitMiB: config.memoryMiB,
        cpu: config.cpu,
        taskRole,
        executionRole,
      },
    );

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/ecs/${prefix}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Build DATABASE_URL from secret
    const dbHost = database.instanceEndpoint.hostname;
    const dbPort = database.instanceEndpoint.port.toString();

    taskDefinition.addContainer("App", {
      // Which ECR tag the task def pulls is governed by the `immutableDeploy`
      // toggle above (a single value shared with deploy-app.sh):
      //
      //   DEFAULT (immutableDeploy=false): the floating `${envName}-latest` tag.
      //     Routine deploys are `update-service --force-new-deployment`, which
      //     re-pulls this tag with no register-task-definition / iam:PassRole —
      //     so the standard labs-power/PowerUserAccess deployer works. The real
      //     protection against the 2026-07-10 outage (a floating tag being
      //     expired out of ECR) is the ECR lifecycle policy, NOT this pin.
      //
      //   OPT-IN (immutableDeploy=true): the immutable `${envName}-${APP_VERSION}`
      //     tag. deploy-app.sh then registers a task-def revision per deploy for
      //     deterministic images + tag-pinned rollbacks — at the cost of needing
      //     iam:PassRole (which PowerUserAccess denies). `build-and-push.sh`
      //     pushes both tags, so either mode works. Both tags are `${envName}-`
      //     prefixed, so both stay inside the ECR lifecycle keep-last-N rules —
      //     a commit-SHA tag would escape them and accumulate forever.
      image: ecs.ContainerImage.fromEcrRepository(
        ecrRepository,
        IMMUTABLE_DEPLOY
          ? `${config.envName}-${APP_VERSION}`
          : `${config.envName}-latest`,
      ),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "app",
        logGroup,
      }),
      environment: {
        // Fargate sets HOSTNAME to an unresolvable task-id value. Next.js'
        // standalone server (server.listen(port, HOSTNAME)) ENOTFOUNDs without
        // this override. The container will fail health checks silently.
        HOSTNAME: "0.0.0.0",
        NODE_OPTIONS: `--max-old-space-size=${Math.floor(config.memoryMiB * 0.75)}`,
        NODE_ENV: "production",
        APP_NAME: config.appName,
        // Real deployment environment for the app. Distinct from NODE_ENV
        // (which stays "production" so Next.js runs optimized in both envs).
        // The LLM module reads this for LiteLLM spend attribution — without it,
        // staging spend gets mislabeled "production" via the NODE_ENV fallback.
        NEXT_PUBLIC_ENVIRONMENT: config.envName,
        // Mapp product line — drives LiteLLM APP_PRODUCT attribution and mirrors
        // the AWS `Product` cost-allocation tag. Set always (harmless when the
        // LLM capability is unused) so the tag and the runtime value never drift.
        APP_PRODUCT: config.product,
        APP_URL: `https://${config.domainName}`,
        NEXTAUTH_URL: `https://${config.domainName}`,
        LOG_LEVEL: config.envName === "staging" ? "info" : "error",
        NODE_EXTRA_CA_CERTS: "/tmp/keycloak-ca.pem",
        S3_REGION: "eu-central-1",
        S3_BUCKET_NAME: config.s3BucketName,
        S3_PREFIX: config.s3Prefix,
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_NAME: config.dbName,
        DB_SSL: "true",
        DB_MAX_CONNECTIONS: "15",
        DB_IDLE_TIMEOUT: "30000",
        DB_CONNECTION_TIMEOUT: "10000",
        ADMIN_GRANULAR_ACCESS_CONTROL: "false",
        // Per-service base URLs for internal Mapp integrations. These are NOT
        // secrets (plain `environment`, not `secrets`), but they ARE
        // per-environment — each internal service is deployed once per
        // environment (INT `k8s-int-01` / PROD `k8s-prod-01`), so the URL is
        // resolved from the env-scoped `sharedSsm` prefix above. An earlier
        // revision of this comment claimed these were environment-agnostic and
        // hardcoded the PROD host; that made staging apps read production data.
        // Sourced from shared SSM via a CloudFormation dynamic reference so the
        // URL lives in exactly one place per environment; if a host moves, shared
        // SSM is updated once and apps pick it up on their next deploy — no
        // per-app code change.
        // Uncomment the ones this app's enabled capabilities need.
        // See docs/template/INTERNAL-API.md + docs/template/capabilities/CLIENT_CATALOG.md.
        //
        // CLIENT_CATALOG_BASE_URL: ssm.StringParameter.valueForStringParameter(
        //   this,
        //   `${sharedSsm}/catalog/cms-base-url`,
        // ),
      },
      secrets: {
        // Database credentials from RDS secret
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentialsSecret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(
          dbCredentialsSecret,
          "password",
        ),
        // Application secrets from SSM
        NEXTAUTH_SECRET: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "NextAuthSecret",
            {
              parameterName: `/${prefix}/NEXTAUTH_SECRET`,
            },
          ),
        ),
        KEYCLOAK_ENABLED: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakEnabled",
            {
              parameterName: `/${prefix}/KEYCLOAK_ENABLED`,
            },
          ),
        ),
        KEYCLOAK_ISSUER: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakIssuer",
            {
              parameterName: `/${prefix}/KEYCLOAK_ISSUER`,
            },
          ),
        ),
        // NOTE: KEYCLOAK_REALM removed — the realm is embedded in
        // KEYCLOAK_ISSUER (.../realms/<realm>); a separate per-app secret was
        // dead config. The shared registrar reads the realm from the shared
        // /labs[-prod]/labs-portal/* namespace, not from here.
        KEYCLOAK_CLIENT_ID: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakClientId",
            {
              parameterName: `/${prefix}/KEYCLOAK_CLIENT_ID`,
            },
          ),
        ),
        KEYCLOAK_CLIENT_SECRET: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakClientSecret",
            {
              parameterName: `/${prefix}/KEYCLOAK_CLIENT_SECRET`,
            },
          ),
        ),
        KEYCLOAK_IDP_HINT: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakIdpHint",
            {
              parameterName: `/${prefix}/KEYCLOAK_IDP_HINT`,
            },
          ),
        ),
        KEYCLOAK_COMPANY_IDP_HINT: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakCompanyIdpHint",
            {
              parameterName: `/${prefix}/KEYCLOAK_COMPANY_IDP_HINT`,
            },
          ),
        ),
        KEYCLOAK_TLS_INSECURE: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakTlsInsecure",
            {
              parameterName: `/${prefix}/KEYCLOAK_TLS_INSECURE`,
            },
          ),
        ),
        // NOTE: internal Mapp HTTPS services (company-management-service,
        // product-feed-service, ...) chain to the Mapp internal root CA
        // (ca.internal.mapp.tools), which is vendored in the image and trusted
        // via the Dockerfile/entrypoint — NOT carried as a per-service SSM secret.
        // KEYCLOAK_CA_PEM below is ONLY for a Keycloak host whose cert is NOT under
        // the internal root. See certs/ca.internal.mapp.tools.crt + docs/template/INTERNAL-CA.md.
        KEYCLOAK_CA_PEM: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "KeycloakCaPem",
            {
              parameterName: `/${prefix}/KEYCLOAK_CA_PEM`,
            },
          ),
        ),
        AZURE_AD_CLIENT_ID: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "AzureAdClientId",
            {
              parameterName: `/${prefix}/AZURE_AD_CLIENT_ID`,
            },
          ),
        ),
        AZURE_AD_CLIENT_SECRET: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "AzureAdClientSecret",
            {
              parameterName: `/${prefix}/AZURE_AD_CLIENT_SECRET`,
            },
          ),
        ),
        AZURE_AD_TENANT_ID: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "AzureAdTenantId",
            {
              parameterName: `/${prefix}/AZURE_AD_TENANT_ID`,
            },
          ),
        ),
        SUPER_ADMINS: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "SuperAdmins",
            {
              parameterName: `/${prefix}/SUPER_ADMINS`,
            },
          ),
        ),
        // Shared internal-API OAuth2 credential (Keycloak realm s2s). ONE
        // credential authenticates every internal Mapp service the app calls
        // (company-management-service / client catalog, product-feed-service /
        // UPC, ...) — integrations do NOT carry their own token-url/client-id/
        // secret. Only per-service base URLs stay separate. The realm-s2s client
        // must be authorized for the services the app uses (the default
        // `mapp-labs` client reaches both client catalog and product feed).
        //
        // Read straight from the SHARED namespace — there is nothing app-specific
        // about this credential, so it is not copied into `/${prefix}/*`. CDK
        // grants the task execution role read on whatever ARN is referenced here.
        // Rotating the secret = one write to shared SSM + restart every app.
        // See src/lib/internal-api/oauth.ts + docs/template/INTERNAL-API.md.
        INTERNAL_API_TOKEN_URL: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "InternalApiTokenUrl",
            {
              parameterName: `${sharedSsm}/internal-api/token-url`,
            },
          ),
        ),
        INTERNAL_API_CLIENT_ID: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "InternalApiClientId",
            {
              parameterName: `${sharedSsm}/internal-api/client-id`,
            },
          ),
        ),
        INTERNAL_API_CLIENT_SECRET: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "InternalApiClientSecret",
            {
              parameterName: `${sharedSsm}/internal-api/client-secret`,
            },
          ),
        ),
        // Uncomment if LLM capability is enabled (see docs/template/capabilities/LLM.md)
        // LITELLM_API_KEY: ecs.Secret.fromSsmParameter(
        //   ssm.StringParameter.fromSecureStringParameterAttributes(
        //     this,
        //     "LitellmApiKey",
        //     {
        //       parameterName: `/${prefix}/LITELLM_API_KEY`,
        //     },
        //   ),
        // ),
        // LITELLM_BASE_URL: ecs.Secret.fromSsmParameter(
        //   ssm.StringParameter.fromSecureStringParameterAttributes(
        //     this,
        //     "LitellmBaseUrl",
        //     {
        //       parameterName: `/${prefix}/LITELLM_BASE_URL`,
        //     },
        //   ),
        // ),
      },
      portMappings: [
        {
          containerPort: 3000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // =========================================================================
    // Application Load Balancer
    // =========================================================================
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: prefix,
    });

    // HTTPS Listener
    const httpsListener = alb.addListener("HttpsListener", {
      port: 443,
      certificates: [certificate],
      sslPolicy: elbv2.SslPolicy.TLS12,
    });

    // HTTP to HTTPS redirect
    alb.addListener("HttpListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        port: "443",
        protocol: "HTTPS",
        permanent: true,
      }),
    });

    // =========================================================================
    // ECS Fargate Service
    // =========================================================================
    const fargateService = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: config.desiredCount,
      serviceName: prefix,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      assignPublicIp: true,
      circuitBreaker: {
        rollback: true,
      },
      enableExecuteCommand: true,
      // Propagate the stack's cost-allocation tags onto the running tasks.
      // Without this, Fargate vCPU/memory usage records in the Cost & Usage
      // Report carry no tags — and Fargate compute is usually the largest line
      // item, so the bulk of per-app/per-env cost would be unattributable.
      enableECSManagedTags: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
    });

    // Add service to ALB target group
    httpsListener.addTargets("EcsTarget", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [fargateService],
      healthCheck: {
        path: "/api/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // =========================================================================
    // Route53 DNS Record
    // =========================================================================
    new route53.ARecord(this, "DnsRecord", {
      zone: hostedZone,
      recordName: config.domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(alb),
      ),
    });

    // =========================================================================
    // Internal Application Load Balancer (non-internet-facing)
    // Allows other services on the Mapp network to reach the app via
    // Transit Gateway without going over the public internet.
    // =========================================================================
    if (config.enableInternalAlb) {
      const internalAlbSg = new ec2.SecurityGroup(
        this,
        "InternalAlbSecurityGroup",
        {
          vpc,
          description: `Internal ALB security group for ${prefix}`,
          allowAllOutbound: true,
        },
      );
      for (const cidr of config.internalAlbCidrs) {
        internalAlbSg.addIngressRule(
          ec2.Peer.ipv4(cidr),
          ec2.Port.tcp(80),
          `Allow HTTP from private network (${cidr})`,
        );
      }

      // Allow ECS tasks to receive traffic from the internal ALB
      ecsSecurityGroup.addIngressRule(
        internalAlbSg,
        ec2.Port.tcp(3000),
        "Allow traffic from internal ALB",
      );

      const internalAlb = new elbv2.ApplicationLoadBalancer(
        this,
        "InternalAlb",
        {
          vpc,
          internetFacing: false,
          securityGroup: internalAlbSg,
          loadBalancerName: `${prefix}-int`,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PUBLIC,
          },
        },
      );

      const internalListener = internalAlb.addListener(
        "InternalHttpListener",
        {
          port: 80,
          protocol: elbv2.ApplicationProtocol.HTTP,
        },
      );

      internalListener.addTargets("InternalEcsTarget", {
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [fargateService],
        healthCheck: {
          path: "/api/health",
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 5,
        },
        deregistrationDelay: cdk.Duration.seconds(30),
      });

      new cdk.CfnOutput(this, "InternalAlbDnsName", {
        value: internalAlb.loadBalancerDnsName,
        description: "Internal ALB DNS Name (private network only)",
      });
    }

    // =========================================================================
    // EventBridge: ECS Task State Change → CloudWatch Logs
    //
    // Relies on the `labs-shared-observability` stack (deployed once per AWS
    // account+region from mapp-agentic-infra) for the CloudWatch Logs
    // resource policy that lets EventBridge write to `/ecs/*/task-state-changes:*`.
    // We use `events.CfnRule` here (not the L2 `events.Rule` + `targets.CloudWatchLogGroup`)
    // because the L2 target construct auto-provisions a per-stack resource
    // policy via `Custom::CloudwatchLogResourcePolicy`, and the region-wide
    // cap of 10 such policies is easy to hit once several projects deploy.
    // =========================================================================
    if (config.enableTaskStateLogging) {
      const taskStateLogGroup = new logs.LogGroup(this, "TaskStateLogGroup", {
        logGroupName: `/ecs/${prefix}/task-state-changes`,
        retention: logs.RetentionDays.THREE_MONTHS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const taskStateRule = new events.CfnRule(
        this,
        "EcsTaskStateChangeRule",
        {
          name: `${prefix}-ecs-task-state-change`,
          eventPattern: {
            source: ["aws.ecs"],
            "detail-type": ["ECS Task State Change"],
            detail: {
              clusterArn: [cluster.clusterArn],
            },
          },
          targets: [
            {
              id: "TaskStateLogTarget",
              arn: taskStateLogGroup.logGroupArn,
            },
          ],
        },
      );
      // Preserve the logical ID produced by the previous L2 `events.Rule`
      // so existing deployments update the resource in place instead of
      // replacing it (the explicit rule name would cause a name collision).
      taskStateRule.overrideLogicalId("EcsTaskStateChangeRuleC4D798EC");
    }

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, "AlbDnsName", {
      value: alb.loadBalancerDnsName,
      description: "ALB DNS Name",
    });

    new cdk.CfnOutput(this, "AppUrl", {
      value: `https://${config.domainName}`,
      description: "Application URL",
    });

    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: ecrRepository.repositoryUri,
      description: "ECR Repository URI",
    });

    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: database.instanceEndpoint.hostname,
      description: "RDS Database Endpoint",
    });

    new cdk.CfnOutput(this, "ClusterName", {
      value: cluster.clusterName,
      description: "ECS Cluster Name",
    });

    new cdk.CfnOutput(this, "ServiceName", {
      value: fargateService.serviceName,
      description: "ECS Service Name",
    });

    new cdk.CfnOutput(this, "LogGroupName", {
      value: logGroup.logGroupName,
      description: "CloudWatch Log Group",
    });
  }
}
