/** @jest-environment node */

/**
 * Contract tests for the maintenance deploy path.
 *
 * These assert the *ordering and safety properties* of a script that can only be
 * exercised for real against live AWS: gate before drain, drain before migrate,
 * reopen only after the rollout is verified, and fail closed in between. They are
 * deliberately text-level — the point is that a well-meaning edit cannot quietly
 * reorder the steps or delete a guard without a test going red.
 *
 * The pure helpers (digest/platform matching, manifest resolution) are executed
 * for real, since they have no AWS dependency.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const maintenanceScriptPath = resolve(
  process.cwd(),
  "scripts/deploy/maintenance-deploy.sh",
);
const fullDeployScriptPath = resolve(
  process.cwd(),
  "scripts/deploy/full-deploy.sh",
);
const digestResolverPath = resolve(
  process.cwd(),
  "scripts/deploy/resolve-runtime-image-digest.py",
);
const runtimeVerificationPath = resolve(
  process.cwd(),
  "scripts/deploy/runtime-image-verification.sh",
);

describe("maintenance deployment contract", () => {
  const script = readFileSync(maintenanceScriptPath, "utf8");

  it("has valid Bash syntax", () => {
    expect(() =>
      execFileSync("bash", [
        "-n",
        maintenanceScriptPath,
        fullDeployScriptPath,
        runtimeVerificationPath,
      ]),
    ).not.toThrow();
  });

  it("gates traffic and drains every app task before migrating", () => {
    const listenerGate = script.indexOf("capture_and_gate_listeners\n");
    const drainStep = script.indexOf('echo "Step 1/6: Draining');
    const waitForFamily = script.lastIndexOf(
      'wait_for_app_family_to_stop "${TASK_FAMILY}"',
    );
    const buildStep = script.indexOf('echo "Step 2/6: Building and pushing');
    const verifyStep = script.indexOf('echo "Step 3/6: Verifying');
    const maintenanceTaskStep = script.indexOf(
      'echo "Step 4/6: Starting one new-image task',
    );
    const migrationStep = script.indexOf(
      'echo "Step 5/6: Running database migrations',
    );
    const reopenStep = script.indexOf(
      'echo "Step 6/6: Restoring service capacity',
    );

    expect(listenerGate).toBeGreaterThan(-1);
    expect(drainStep).toBeGreaterThan(listenerGate);
    expect(script.indexOf("PRE_DRAIN_TASKS", drainStep)).toBeGreaterThan(
      drainStep,
    );
    expect(waitForFamily).toBeGreaterThan(drainStep);
    expect(buildStep).toBeGreaterThan(waitForFamily);
    expect(verifyStep).toBeGreaterThan(buildStep);
    expect(maintenanceTaskStep).toBeGreaterThan(verifyStep);
    expect(migrationStep).toBeGreaterThan(maintenanceTaskStep);
    expect(reopenStep).toBeGreaterThan(migrationStep);
  });

  it("runs the migration as an ECS Exec job that reports a real exit status", () => {
    // `aws ecs execute-command` exits 0 whenever the SSM session worked, so a
    // failed migration is indistinguishable from a successful one without the
    // result marker. Losing this check would let a broken release reopen.
    expect(script).not.toContain("run-task");
    expect(script).toContain(
      'run_exec_job "migrate" "${MAINTENANCE_TASK_ARN}" "npx prisma migrate deploy"',
    );
    expect(script).toContain("MAINTENANCE_RESULT:");
    expect(script).toContain('if [[ "${remote_status}" != "0" ]]');
  });

  it("verifies the running task is this release's image, on both deploy models", () => {
    expect(script).toContain('RELEASE_TAG="${ENV}-${APP_VERSION}"');
    expect(script).toContain('RELEASE_TAG="${ENV}-latest"');
    expect(script).toContain("resolve_expected_runtime_digest");
    expect(script).toContain("runtime_image_digest_matches_release");
    expect(script).toContain("require_expected_runtime_platform");
    // Once for the gated migration task, once for every task serving after the
    // reopen.
    expect(script.match(/require_release_image_digest "\$\{/g)).toHaveLength(2);
  });

  it("gates the public listener and the internal one when it exists", () => {
    expect(script).toContain('PUBLIC_ALB_NAME="${CLUSTER_NAME}"');
    expect(script).toContain('INTERNAL_ALB_NAME="${CLUSTER_NAME}-int"');
    expect(script).toContain('"StatusCode":"503"');
    expect(script).toContain("--priority 1");
    expect(script).toContain("${APP_NAME}-maintenance-deploy");
    expect(script).toContain("remove_maintenance_gates");
    // An internal ALB is optional (infra `enableInternalAlb`), so a missing one
    // must be skipped rather than failing the deploy.
    expect(script).toContain("LoadBalancerNotFound");
  });

  it("quiesces the app's scheduled rules without touching observability rules", () => {
    // The template's own ${prefix}-ecs-task-state-change rule is event-pattern
    // based; disabling it would blind the maintenance window it exists to record.
    expect(script).toContain("ScheduleExpression");
    expect(script).toContain("MAINTENANCE_SCHEDULE_RULES");
    expect(script).toContain("restore_original_schedules");
    expect(script).toContain('SCHEDULES_MAY_START_NEW_IMAGE=true');
  });

  it("waits for ECS Exec readiness and re-drains after a failed rollout", () => {
    expect(script).toContain("wait_for_exec_agent");
    expect(script).toContain('if [[ "${agent_status}" == "RUNNING" ]]');
    expect(script).toContain(
      'elif ! wait_for_app_family_to_stop "${TASK_FAMILY}"',
    );
    expect(
      script.match(
        /require_only_maintenance_task_running "\$\{MAINTENANCE_TASK_ARN\}"/g,
      ),
    ).toHaveLength(2);
  });

  it("prevents automatic rollback to the old revision", () => {
    const disableRollback = script.indexOf(
      "deploymentCircuitBreaker={enable=true,rollback=false}",
    );
    const restoreRollback = script.lastIndexOf(
      "deploymentCircuitBreaker={enable=${ORIGINAL_CIRCUIT_BREAKER_ENABLED},rollback=${ORIGINAL_CIRCUIT_BREAKER_ROLLBACK}}",
    );

    expect(disableRollback).toBeGreaterThan(-1);
    expect(restoreRollback).toBeGreaterThan(disableRollback);
    expect(script).toContain("do not restart the old application revision");
    expect(script).toContain("MAINTENANCE_RESTORE_DESIRED_COUNT");
  });

  it("requires an explicit acknowledgement of the downtime", () => {
    expect(script).toContain("CONFIRM_MAINTENANCE_DOWNTIME");
    expect(script).toContain("Maintenance deployment cancelled.");
  });

  it("keeps the default full-deploy entrypoint rolling, not maintenance", () => {
    // The default deploy path must stay up: it builds, rolls the ECS service,
    // then migrates. Taking an environment offline is opt-in via the separate
    // maintenance entrypoint, so full-deploy must NOT delegate to it.
    const fullDeployScript = readFileSync(fullDeployScriptPath, "utf8");

    expect(fullDeployScript).not.toContain("maintenance-deploy.sh ${ENV}");
    expect(fullDeployScript).toContain("build-and-push.sh");
    expect(fullDeployScript).toContain("deploy-app.sh");
    expect(fullDeployScript).toContain("run-migration.sh");
  });

  it("points operators at the maintenance path for breaking migrations", () => {
    // Discoverability matters more than usual here: the one case that needs the
    // maintenance path is also the one where getting it wrong is an outage.
    const fullDeployScript = readFileSync(fullDeployScriptPath, "utf8");
    expect(fullDeployScript).toContain("prod-deploy-maintenance");
  });

  it("exposes both deploy paths as make targets per environment", () => {
    const makefile = readFileSync(resolve(process.cwd(), "Makefile"), "utf8");

    for (const target of [
      "staging-deploy:",
      "staging-deploy-maintenance:",
      "prod-deploy:",
      "prod-deploy-maintenance:",
    ]) {
      expect(makefile).toContain(target);
    }

    // The default targets run the rolling script; the -maintenance ones drain.
    expect(makefile).toContain("./scripts/deploy/full-deploy.sh production");
    expect(makefile).toContain(
      "./scripts/deploy/maintenance-deploy.sh production",
    );
  });
});

describe("runtime image verification", () => {
  const runHelper = (functionName: string, ...args: string[]) =>
    execFileSync(
      "bash",
      [
        "-c",
        'source "$1"; shift; "$@"',
        "bash",
        runtimeVerificationPath,
        functionName,
        ...args,
      ],
      { stdio: "pipe" },
    );

  it.each([
    ["verified child", "sha256:child"],
    ["verified root", "sha256:root"],
  ])("accepts the %s digest", (_name, actual) => {
    expect(() =>
      runHelper(
        "runtime_image_digest_matches_release",
        actual,
        "sha256:child",
        "sha256:root",
      ),
    ).not.toThrow();
  });

  it.each(["sha256:sibling", "", "None"])(
    "rejects an unrelated or missing runtime digest: %s",
    (actual) => {
      expect(() =>
        runHelper(
          "runtime_image_digest_matches_release",
          actual,
          "sha256:child",
          "sha256:root",
        ),
      ).toThrow();
    },
  );

  it.each(["Linux", "LINUX"])(
    "accepts the live %s/x86_64 Fargate platform",
    (platformFamily) => {
      expect(() =>
        runHelper("runtime_platform_matches_release", platformFamily, "x86_64"),
      ).not.toThrow();
    },
  );

  it.each([
    ["Windows", "x86_64"],
    ["Linux", "arm64"],
    ["", "x86_64"],
    ["Linux", ""],
  ])("rejects the unexpected %s/%s platform", (family, architecture) => {
    expect(() =>
      runHelper("runtime_platform_matches_release", family, architecture),
    ).toThrow();
  });
});

describe("runtime image digest resolver", () => {
  const resolveDigest = (manifest: object, root = "sha256:root") =>
    execFileSync("python3", [digestResolverPath, root], {
      input: JSON.stringify(manifest),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

  it("selects the linux/amd64 child and ignores an attestation descriptor", () => {
    expect(
      resolveDigest({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [
          {
            digest: "sha256:runtime",
            platform: { os: "linux", architecture: "amd64" },
          },
          {
            digest: "sha256:attestation",
            platform: { os: "unknown", architecture: "unknown" },
          },
        ],
      }),
    ).toBe("sha256:runtime");
  });

  it("uses the root digest for a single image manifest", () => {
    expect(
      resolveDigest({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }),
    ).toBe("sha256:root");
  });

  it.each([
    {
      name: "zero",
      manifests: [
        {
          digest: "sha256:arm",
          platform: { os: "linux", architecture: "arm64" },
        },
      ],
    },
    {
      name: "multiple",
      manifests: [
        {
          digest: "sha256:first",
          platform: { os: "linux", architecture: "amd64" },
        },
        {
          digest: "sha256:second",
          platform: { os: "linux", architecture: "amd64" },
        },
      ],
    },
  ])("rejects $name linux/amd64 descriptors", ({ manifests }) => {
    expect(() =>
      resolveDigest({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests,
      }),
    ).toThrow();
  });
});
