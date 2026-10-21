#!/usr/bin/env bash
set -Eeuo pipefail

# Maintenance-safe application deployment — the opt-in path for releases whose
# database migration is NOT backwards-compatible.
#
# `full-deploy.sh` (make <env>-deploy) is the default: it rolls the ECS service
# and migrates afterwards, so the app never goes down but an outgoing task can
# briefly serve requests against the new schema. That is fine for additive
# migrations and wrong for a rename or a drop. This script takes real downtime
# instead, and guarantees that no serving task ever uses the old code against
# the new schema:
#
#   1. Gate every application load balancer with a 503 and quiesce the app's
#      own scheduled EventBridge rules.
#   2. Scale the service to zero and wait for every task in the family to stop.
#   3. Build and push the release image.
#   4. Verify the published tags all resolve to one ECR manifest digest.
#   5. Start exactly one new-image task behind the gates.
#   6. Run `prisma migrate deploy` (and an optional post-migrate command) in
#      that task via ECS Exec.
#   7. Restore capacity, the deployment config, the gates, and the schedules.
#
# FAIL-CLOSED. If anything after the drain fails, the service deliberately stays
# at desired count 0 and the ALB gates stay up. A failed maintenance deploy is an
# outage to fix forward, not an automatic rollback: restarting the old revision
# against a migrated schema is how you turn a failed release into data damage.
#
# Usage:
#   ./scripts/deploy/maintenance-deploy.sh staging
#   ./scripts/deploy/maintenance-deploy.sh production
#
# Non-interactive callers must acknowledge the downtime explicitly:
#   CONFIRM_MAINTENANCE_DOWNTIME=yes ./scripts/deploy/maintenance-deploy.sh staging
#
# Optional environment variables:
#   MAINTENANCE_POST_MIGRATE_COMMAND   shell command run in the gated task after
#                                      the migration (e.g. a cache/index rebuild
#                                      that must not run against the old schema).
#   MAINTENANCE_SCHEDULE_RULES         space-separated EventBridge rule names to
#                                      quiesce, overriding auto-discovery.
#   MAINTENANCE_RESTORE_DESIRED_COUNT  set to 1 to retry after a failed attempt
#                                      left the service at desired count 0.
#   IMAGE_TAG                          commit/traceability tag (default: short SHA).

ENV="${1:-}"
if [[ "${ENV}" != "staging" && "${ENV}" != "production" ]]; then
    echo "Error: environment must be 'staging' or 'production' (got '${ENV}')" >&2
    exit 1
fi

AWS_PROFILE="${AWS_PROFILE:-labs-power}"
AWS_REGION="eu-central-1"
# shellcheck source=_config.sh
source "$(dirname "$0")/_config.sh"
# shellcheck source=runtime-image-verification.sh
source "${SCRIPT_DIR}/runtime-image-verification.sh"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
if [[ ! "${IMAGE_TAG}" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
    echo "Error: IMAGE_TAG is not a valid Docker tag: ${IMAGE_TAG}" >&2
    exit 1
fi

APP_VERSION="$(node -p "require(process.argv[1]).version" "$(to_node_path "${PROJECT_ROOT}/package.json")")"
CLUSTER_NAME="${APP_NAME}-${SHORT_ENV}"
SERVICE_NAME="${APP_NAME}-${SHORT_ENV}"
CONTAINER_NAME="App"
# Both ALB names come from `prefix` in infra/lib/stack.ts. The internal one is
# only created when `enableInternalAlb` is set, so it is optional here.
PUBLIC_ALB_NAME="${CLUSTER_NAME}"
INTERNAL_ALB_NAME="${CLUSTER_NAME}-int"

# The tag the ECS task definition tracks, per the active deploy model
# (app.config.json `immutableDeploy` — see deploy-app.sh).
if [[ "${IMMUTABLE_DEPLOY}" == "true" ]]; then
    RELEASE_TAG="${ENV}-${APP_VERSION}"
else
    RELEASE_TAG="${ENV}-latest"
fi

if ! command -v session-manager-plugin >/dev/null 2>&1; then
    echo "Error: session-manager-plugin is required for ECS Exec." >&2
    echo "       brew install --cask session-manager-plugin (macOS); other platforms:" >&2
    echo "       https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html" >&2
    exit 1
fi

if [[ "${CONFIRM_MAINTENANCE_DOWNTIME:-}" != "yes" ]]; then
    echo "This deployment will scale ${CLUSTER_NAME}/${SERVICE_NAME} to zero."
    echo "${APP_NAME} will be unavailable from the moment the load balancers are"
    echo "gated until the migration and the new rollout both succeed."
    echo ""
    read -r -p "Type '${ENV}' to continue: " confirmation
    if [[ "${confirmation}" != "${ENV}" ]]; then
        echo "Maintenance deployment cancelled."
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Rollback/cleanup state. Every flag records a step that cleanup() may need to
# undo — or must deliberately NOT undo.
# ---------------------------------------------------------------------------
SCHEDULE_RULES=()
SCHEDULE_STATES=()
SCHEDULES_CAPTURED=false
SCHEDULES_MAY_START_NEW_IMAGE=false
GATE_RULE_ARNS=()
LISTENERS_GATED=false
GATES_REMOVED=false
SERVICE_DRAINED=false
SERVICE_RESTORED=false
ROLLBACK_DISABLED=false
ROLLBACK_RESTORED=false
TASK_FAMILY=""
ORIGINAL_CIRCUIT_BREAKER_ENABLED=""
ORIGINAL_CIRCUIT_BREAKER_ROLLBACK=""

aws_ecs() {
    aws ecs "$@" --region "${AWS_REGION}" --profile "${AWS_PROFILE}"
}

aws_ecr() {
    aws ecr "$@" --region "${AWS_REGION}" --profile "${AWS_PROFILE}"
}

aws_elbv2() {
    aws elbv2 "$@" --region "${AWS_REGION}" --profile "${AWS_PROFILE}"
}

aws_events() {
    aws events "$@" --region "${AWS_REGION}" --profile "${AWS_PROFILE}"
}

restore_original_schedules() {
    local index
    local restore_failed=0

    if [[ "${SCHEDULES_CAPTURED}" != "true" ]]; then
        return 0
    fi

    for ((index = 0; index < ${#SCHEDULE_STATES[@]}; index++)); do
        if [[ "${SCHEDULE_STATES[$index]}" == "ENABLED" ]]; then
            if ! aws_events enable-rule --name "${SCHEDULE_RULES[$index]}" >/dev/null; then
                echo "WARNING: Failed to re-enable EventBridge rule ${SCHEDULE_RULES[$index]}" >&2
                restore_failed=1
            fi
        fi
    done

    return "${restore_failed}"
}

remove_maintenance_gates() {
    local gate_rule_arn
    local remove_failed=0

    if [[ "${LISTENERS_GATED}" != "true" ]]; then
        return 0
    fi

    for gate_rule_arn in "${GATE_RULE_ARNS[@]}"; do
        if ! aws_elbv2 delete-rule --rule-arn "${gate_rule_arn}" >/dev/null; then
            echo "WARNING: Failed to remove ALB maintenance rule ${gate_rule_arn}" >&2
            remove_failed=1
        fi
    done

    if [[ "${remove_failed}" -eq 0 ]]; then
        GATES_REMOVED=true
    fi
    return "${remove_failed}"
}

wait_for_app_family_to_stop() {
    local task_family="$1"
    local running_tasks

    while true; do
        running_tasks="$(
            aws_ecs list-tasks \
                --cluster "${CLUSTER_NAME}" \
                --family "${task_family}" \
                --desired-status RUNNING \
                --query "taskArns" \
                --output text
        )"
        if [[ -z "${running_tasks}" || "${running_tasks}" == "None" ]]; then
            return 0
        fi

        echo "Waiting for existing app-family task(s) to stop: ${running_tasks}"
        # shellcheck disable=SC2086
        aws_ecs wait tasks-stopped --cluster "${CLUSTER_NAME}" --tasks ${running_tasks}
    done
}

cleanup() {
    local status=$?
    local listener_restore_failed=0
    local schedule_restore_failed=0
    local service_drain_failed=0
    local index
    trap - EXIT
    set +e

    # A failed rollout can leave desiredCount restored even though the release is
    # unhealthy (or can have tripped an old-revision rollback). Enforce the
    # fail-closed state before any other cleanup.
    if [[ "${status}" -ne 0 && "${SERVICE_DRAINED}" == "true" && "${SERVICE_RESTORED}" != "true" ]]; then
        if ! aws_ecs update-service \
            --cluster "${CLUSTER_NAME}" \
            --service "${SERVICE_NAME}" \
            --desired-count 0 >/dev/null; then
            service_drain_failed=1
        elif ! aws_ecs wait services-stable \
            --cluster "${CLUSTER_NAME}" \
            --services "${SERVICE_NAME}"; then
            service_drain_failed=1
        elif ! wait_for_app_family_to_stop "${TASK_FAMILY}"; then
            service_drain_failed=1
        fi
    fi

    # With desired count zero and the whole task family idle, restoring the
    # captured deployment configuration cannot resurrect the old revision.
    if [[ "${status}" -ne 0 && "${ROLLBACK_DISABLED}" == "true" && "${ROLLBACK_RESTORED}" != "true" && "${service_drain_failed}" -eq 0 ]]; then
        if aws_ecs update-service \
            --cluster "${CLUSTER_NAME}" \
            --service "${SERVICE_NAME}" \
            --deployment-configuration \
            "deploymentCircuitBreaker={enable=${ORIGINAL_CIRCUIT_BREAKER_ENABLED},rollback=${ORIGINAL_CIRCUIT_BREAKER_ROLLBACK}}" \
            >/dev/null; then
            ROLLBACK_RESTORED=true
        fi
    fi

    # Reopen traffic only after success, or after desired count zero and the app
    # family are confirmed idle. A partially gated pre-drain failure stays
    # fail-closed and is adopted by the next attempt.
    if [[ "${LISTENERS_GATED}" == "true" ]]; then
        if [[ "${status}" -eq 0 || "${SERVICE_RESTORED}" == "true" || ("${SERVICE_DRAINED}" == "true" && "${service_drain_failed}" -eq 0) ]]; then
            remove_maintenance_gates
            listener_restore_failed=$?
        else
            echo "IMPORTANT: ALB maintenance gates remain active because the deploy did not reach a confirmed safe reopen state." >&2
        fi
    fi

    # Before the release image is published, restoring the original rule states is
    # always safe. After that point a scheduled task could start the NEW image
    # against the OLD schema, so schedules stay disabled until the deploy has
    # actually completed.
    if [[ "${SERVICE_RESTORED}" == "true" ]]; then
        restore_original_schedules
        schedule_restore_failed=$?
    elif [[ "${SCHEDULES_MAY_START_NEW_IMAGE}" != "true" ]]; then
        restore_original_schedules
        schedule_restore_failed=$?
    elif [[ "${SCHEDULES_CAPTURED}" == "true" ]]; then
        echo ""
        echo "IMPORTANT: Scheduled ${APP_NAME} tasks remain disabled because the deployment"
        echo "did not complete after the release image may have been published."
        echo "After a successful recovery deploy, restore only the rules that were"
        echo "enabled before this attempt:"
        for ((index = 0; index < ${#SCHEDULE_STATES[@]}; index++)); do
            if [[ "${SCHEDULE_STATES[$index]}" == "ENABLED" ]]; then
                echo "  aws events enable-rule --name ${SCHEDULE_RULES[$index]} \\"
                echo "    --profile ${AWS_PROFILE} --region ${AWS_REGION}"
            fi
        done
    fi

    if [[ "${status}" -eq 0 && ("${listener_restore_failed}" -ne 0 || "${schedule_restore_failed}" -ne 0) ]]; then
        status=1
    fi

    if [[ "${status}" -ne 0 ]]; then
        echo ""
        echo "==========================================" >&2
        echo "Maintenance deployment failed." >&2
        if [[ "${SERVICE_DRAINED}" == "true" && "${SERVICE_RESTORED}" != "true" ]]; then
            if [[ "${service_drain_failed}" -eq 0 ]]; then
                echo "${CLUSTER_NAME}/${SERVICE_NAME} remains at desired count 0." >&2
            else
                echo "WARNING: Could not confirm ${CLUSTER_NAME}/${SERVICE_NAME} reached desired count 0." >&2
                echo "Inspect the service immediately; do not allow an old revision to serve." >&2
            fi
            echo "This is intentional: do not restart the old application revision" >&2
            echo "against a potentially migrated database." >&2
            echo "Fix forward, then retry with MAINTENANCE_RESTORE_DESIRED_COUNT=1." >&2
        fi
        if [[ "${ROLLBACK_DISABLED}" == "true" && "${ROLLBACK_RESTORED}" != "true" ]]; then
            echo "The ECS deployment circuit-breaker rollback remains disabled." >&2
        fi
        if [[ "${LISTENERS_GATED}" == "true" && "${GATES_REMOVED}" != "true" ]]; then
            echo "The ALB maintenance gates remain active (users see HTTP 503)." >&2
        fi
        echo "==========================================" >&2
    fi

    exit "${status}"
}
trap cleanup EXIT

verify_published_release_tags() {
    local tag
    local digest

    for tag in "${RELEASE_TAG}" "${ENV}-latest" "${ENV}-${APP_VERSION}" "${IMAGE_TAG}"; do
        digest="$(
            aws_ecr describe-images \
                --repository-name "${ECR_REPO}" \
                --image-ids "imageTag=${tag}" \
                --query "imageDetails[0].imageDigest" \
                --output text
        )"
        if [[ "${digest}" != "${RELEASE_MANIFEST_DIGEST}" ]]; then
            echo "Error: ECR tag '${tag}' no longer resolves to this release" >&2
            echo "Expected: ${RELEASE_MANIFEST_DIGEST}" >&2
            echo "Actual:   ${digest}" >&2
            return 1
        fi
    done
}

resolve_expected_runtime_digest() {
    local image_manifest

    image_manifest="$(
        aws_ecr batch-get-image \
            --repository-name "${ECR_REPO}" \
            --image-ids "imageDigest=${RELEASE_MANIFEST_DIGEST}" \
            --query "images[0].imageManifest" \
            --output text
    )"
    if [[ -z "${image_manifest}" || "${image_manifest}" == "None" ]]; then
        echo "Error: ECR did not return the release image manifest" >&2
        return 1
    fi

    printf "%s" "${image_manifest}" |
        run_python "${SCRIPT_DIR}/resolve-runtime-image-digest.py" "${RELEASE_MANIFEST_DIGEST}"
}

require_expected_runtime_platform() {
    local task_arn="$1"
    local platform_family
    local cpu_architecture

    platform_family="$(
        aws_ecs describe-tasks \
            --cluster "${CLUSTER_NAME}" \
            --tasks "${task_arn}" \
            --query "tasks[0].platformFamily" \
            --output text
    )"
    cpu_architecture="$(
        aws_ecs describe-tasks \
            --cluster "${CLUSTER_NAME}" \
            --tasks "${task_arn}" \
            --query "tasks[0].attributes[?name=='ecs.cpu-architecture'].value | [0]" \
            --output text
    )"

    if ! runtime_platform_matches_release "${platform_family}" "${cpu_architecture}"; then
        echo "Error: Application task does not use the required Linux/x86_64 platform" >&2
        echo "Platform family:  ${platform_family}" >&2
        echo "CPU architecture: ${cpu_architecture}" >&2
        return 1
    fi
}

require_release_image_digest() {
    local task_arn="$1"
    local digest

    require_expected_runtime_platform "${task_arn}"
    digest="$(
        aws_ecs describe-tasks \
            --cluster "${CLUSTER_NAME}" \
            --tasks "${task_arn}" \
            --query "tasks[0].containers[?name=='${CONTAINER_NAME}'].imageDigest | [0]" \
            --output text
    )"
    if [[ -z "${digest}" || "${digest}" == "None" ]]; then
        echo "Error: ECS did not report an image digest for ${task_arn}" >&2
        return 1
    fi
    if ! runtime_image_digest_matches_release \
        "${digest}" \
        "${EXPECTED_RUNTIME_IMAGE_DIGEST}" \
        "${RELEASE_MANIFEST_DIGEST}"; then
        echo "Error: Task ${task_arn} is not running this release's linux/amd64 image" >&2
        echo "Expected child: ${EXPECTED_RUNTIME_IMAGE_DIGEST}" >&2
        echo "Expected root:  ${RELEASE_MANIFEST_DIGEST}" >&2
        echo "Actual:         ${digest}" >&2
        return 1
    fi
    RUNTIME_IMAGE_DIGEST="${digest}"
}

# Scheduled rules that can start an app task on their own must be quiesced for
# the window, or one of them fires the NEW image against the OLD schema (or the
# old image against the new one) while the service is drained.
#
# Discovery is by `${CLUSTER_NAME}-` name prefix, restricted to rules that carry
# a ScheduleExpression. The template's own `${CLUSTER_NAME}-ecs-task-state-change`
# rule is event-pattern based and is deliberately left alone: it only writes task
# state changes to CloudWatch Logs, which is exactly what you want during a
# maintenance window. Rules created in EventBridge Scheduler (the newer `aws
# scheduler` API) are NOT found by this — set MAINTENANCE_SCHEDULE_RULES if the
# app has any, or if its schedules are named off-prefix.
discover_schedule_rules() {
    local rule
    local schedule_expression

    if [[ -n "${MAINTENANCE_SCHEDULE_RULES:-}" ]]; then
        for rule in ${MAINTENANCE_SCHEDULE_RULES}; do
            SCHEDULE_RULES+=("${rule}")
        done
        return 0
    fi

    # Assigned first rather than iterated inline: a failed `list-rules` inside a
    # `for` list would be swallowed and silently discover nothing, which is
    # exactly the wrong way for this to fail.
    local candidate_rules
    candidate_rules="$(
        aws_events list-rules \
            --name-prefix "${CLUSTER_NAME}-" \
            --query "Rules[].Name" \
            --output text
    )"

    for rule in ${candidate_rules}; do
        schedule_expression="$(
            aws_events describe-rule \
                --name "${rule}" \
                --query "ScheduleExpression" \
                --output text
        )"
        if [[ -n "${schedule_expression}" && "${schedule_expression}" != "None" ]]; then
            SCHEDULE_RULES+=("${rule}")
        fi
    done
}

capture_and_disable_schedules() {
    local rule
    local state

    discover_schedule_rules
    if [[ "${#SCHEDULE_RULES[@]}" -eq 0 ]]; then
        echo "No app-owned scheduled EventBridge rules found (nothing to quiesce)."
        return 0
    fi

    echo "Disabling app-owned EventBridge schedules..."
    SCHEDULES_CAPTURED=true
    for rule in "${SCHEDULE_RULES[@]}"; do
        state="$(aws_events describe-rule --name "${rule}" --query "State" --output text)"
        if [[ "${state}" != "ENABLED" && "${state}" != "DISABLED" ]]; then
            echo "Error: Unexpected state '${state}' for EventBridge rule ${rule}" >&2
            return 1
        fi

        SCHEDULE_STATES+=("${state}")
        if [[ "${state}" == "ENABLED" ]]; then
            echo "  disabling ${rule}"
            aws_events disable-rule --name "${rule}"
        fi
    done
}

# Gate one listener with a priority-1 fixed 503. An existing priority-1 rule is
# adopted only if it is one of ours (a previous failed run left it): anything
# else is a real routing rule this script must not stomp on.
gate_listener() {
    local listener_arn="$1"
    local default_action_types
    local existing_rule_arn
    local existing_rule_owner
    local existing_rule_type
    local existing_rule_status
    local gate_rule_arn
    local maintenance_action
    local maintenance_condition

    # printf rather than an interpolated string so the JSON stays readable (and
    # greppable) in the source.
    maintenance_action="$(printf \
        '[{"Type":"fixed-response","FixedResponseConfig":{"MessageBody":"%s is temporarily unavailable for maintenance.","StatusCode":"503","ContentType":"text/plain"}}]' \
        "${APP_NAME}")"
    maintenance_condition='[{"Field":"path-pattern","PathPatternConfig":{"Values":["/*"]}}]'

    default_action_types="$(
        aws_elbv2 describe-listeners \
            --listener-arns "${listener_arn}" \
            --query "Listeners[0].DefaultActions[].Type" \
            --output text
    )"
    if [[ "${default_action_types}" != "forward" ]]; then
        echo "Error: Listener ${listener_arn} does not have the expected forward default action" >&2
        return 1
    fi

    existing_rule_arn="$(
        aws_elbv2 describe-rules \
            --listener-arn "${listener_arn}" \
            --query "Rules[?Priority=='1'].RuleArn | [0]" \
            --output text
    )"
    if [[ -n "${existing_rule_arn}" && "${existing_rule_arn}" != "None" ]]; then
        existing_rule_owner="$(
            aws_elbv2 describe-tags \
                --resource-arns "${existing_rule_arn}" \
                --query "TagDescriptions[0].Tags[?Key=='ManagedBy'].Value | [0]" \
                --output text
        )"
        existing_rule_type="$(
            aws_elbv2 describe-rules \
                --rule-arns "${existing_rule_arn}" \
                --query "Rules[0].Actions[0].Type" \
                --output text
        )"
        existing_rule_status="$(
            aws_elbv2 describe-rules \
                --rule-arns "${existing_rule_arn}" \
                --query "Rules[0].Actions[0].FixedResponseConfig.StatusCode" \
                --output text
        )"
        if [[ "${existing_rule_owner}" != "${APP_NAME}-maintenance-deploy" ||
            "${existing_rule_type}" != "fixed-response" ||
            "${existing_rule_status}" != "503" ]]; then
            echo "Error: Listener priority 1 is occupied by a rule this script does not own" >&2
            echo "Rule: ${existing_rule_arn}" >&2
            return 1
        fi
        GATE_RULE_ARNS+=("${existing_rule_arn}")
        LISTENERS_GATED=true
        echo "  adopted existing maintenance gate on ${listener_arn}"
        return 0
    fi

    gate_rule_arn="$(
        aws_elbv2 create-rule \
            --listener-arn "${listener_arn}" \
            --priority 1 \
            --conditions "${maintenance_condition}" \
            --actions "${maintenance_action}" \
            --query "Rules[0].RuleArn" \
            --output text
    )"
    if [[ -z "${gate_rule_arn}" || "${gate_rule_arn}" == "None" ]]; then
        echo "Error: ALB did not create a maintenance rule for ${listener_arn}" >&2
        return 1
    fi
    GATE_RULE_ARNS+=("${gate_rule_arn}")
    LISTENERS_GATED=true
    aws_elbv2 add-tags \
        --resource-arns "${gate_rule_arn}" \
        --tags "Key=ManagedBy,Value=${APP_NAME}-maintenance-deploy"
    echo "  gated ${listener_arn}"
}

resolve_listener_arn() {
    local alb_name="$1"
    local port="$2"
    local required="$3"
    local describe_output
    local alb_arn

    if ! describe_output="$(
        aws_elbv2 describe-load-balancers \
            --names "${alb_name}" \
            --query "LoadBalancers[0].LoadBalancerArn" \
            --output text 2>&1
    )"; then
        if [[ "${required}" != "true" && "${describe_output}" == *"LoadBalancerNotFound"* ]]; then
            return 0
        fi
        echo "Error: Could not resolve load balancer ${alb_name}" >&2
        echo "${describe_output}" >&2
        return 1
    fi

    alb_arn="${describe_output}"
    aws_elbv2 describe-listeners \
        --load-balancer-arn "${alb_arn}" \
        --query "Listeners[?Port==\`${port}\`].ListenerArn | [0]" \
        --output text
}

capture_and_gate_listeners() {
    local public_listener_arn
    local internal_listener_arn

    echo "Gating application load balancer listeners..."
    public_listener_arn="$(resolve_listener_arn "${PUBLIC_ALB_NAME}" 443 true)"
    if [[ -z "${public_listener_arn}" || "${public_listener_arn}" == "None" ]]; then
        echo "Error: Could not resolve the public HTTPS listener on ${PUBLIC_ALB_NAME}" >&2
        return 1
    fi
    gate_listener "${public_listener_arn}"

    # Optional: only exists when infra config sets enableInternalAlb.
    internal_listener_arn="$(resolve_listener_arn "${INTERNAL_ALB_NAME}" 80 false)"
    if [[ -n "${internal_listener_arn}" && "${internal_listener_arn}" != "None" ]]; then
        gate_listener "${internal_listener_arn}"
    else
        echo "  no internal ALB (${INTERNAL_ALB_NAME}) — skipping"
    fi
}

# The ExecuteCommandAgent starts a little after the container does; running the
# migration before it is RUNNING fails with TargetNotConnectedException. Parsed
# in python rather than JMESPath because the nested managedAgents projection is
# easy to get subtly wrong, and a wrong query here silently burns the timeout.
wait_for_exec_agent() {
    local task_arn="$1"
    local attempt
    local agent_status

    for ((attempt = 1; attempt <= 60; attempt++)); do
        agent_status="$(
            aws_ecs describe-tasks \
                --cluster "${CLUSTER_NAME}" \
                --tasks "${task_arn}" \
                --output json |
                CONTAINER_NAME="${CONTAINER_NAME}" run_python -c '
import json
import os
import sys

container_name = os.environ["CONTAINER_NAME"]
task = json.load(sys.stdin)["tasks"][0]
for container in task.get("containers", []):
    if container.get("name") != container_name:
        continue
    for agent in container.get("managedAgents", []):
        if agent.get("name") == "ExecuteCommandAgent":
            print(agent.get("lastStatus", "MISSING"))
            raise SystemExit(0)
print("MISSING")
'
        )"
        if [[ "${agent_status}" == "RUNNING" ]]; then
            return 0
        fi
        if [[ "${agent_status}" == "STOPPED" ]]; then
            echo "Error: ECS ExecuteCommandAgent stopped before the migration could run" >&2
            return 1
        fi
        sleep 5
    done

    echo "Error: ECS ExecuteCommandAgent did not reach RUNNING" >&2
    return 1
}

require_only_maintenance_task_running() {
    local maintenance_task_arn="$1"
    local running_tasks
    local running_task
    local maintenance_task_count=0

    running_tasks="$(
        aws_ecs list-tasks \
            --cluster "${CLUSTER_NAME}" \
            --family "${TASK_FAMILY}" \
            --desired-status RUNNING \
            --query "taskArns" \
            --output text
    )"
    for running_task in ${running_tasks}; do
        if [[ "${running_task}" != "${maintenance_task_arn}" ]]; then
            echo "Error: Unexpected app-family task is running: ${running_task}" >&2
            return 1
        fi
        maintenance_task_count=$((maintenance_task_count + 1))
    done

    if [[ "${maintenance_task_count}" -ne 1 ]]; then
        echo "Error: Expected exactly one maintenance task, found ${maintenance_task_count}" >&2
        return 1
    fi
}

# `aws ecs execute-command` exits 0 as long as the SSM session itself worked —
# a failed remote command looks identical to a successful one. The marker echo
# carries the real exit status back out through the session transcript.
run_exec_job() {
    local job_name="$1"
    local task_arn="$2"
    local job_command="$3"
    local marker="MAINTENANCE_RESULT:${job_name}:"
    local remote_command
    local output
    local cli_status=0
    local remote_status

    remote_command="/app/docker-entrypoint.sh sh -c '${job_command}; status=\$?; echo ${marker}\${status}; exit \${status}'"

    output="$(
        aws_ecs execute-command \
            --cluster "${CLUSTER_NAME}" \
            --task "${task_arn}" \
            --container "${CONTAINER_NAME}" \
            --interactive \
            --command "${remote_command}" 2>&1
    )" || cli_status=$?
    printf "%s\n" "${output}"

    remote_status="$(
        printf "%s\n" "${output}" |
            sed -n "s/.*${marker}\\([0-9][0-9]*\\).*/\\1/p" |
            tail -n 1
    )"
    if [[ "${cli_status}" -ne 0 ]]; then
        echo "Error: ECS Exec ${job_name} session failed with status ${cli_status}" >&2
        return 1
    fi
    if [[ "${remote_status}" != "0" ]]; then
        echo "Error: ${job_name} did not report a successful result marker" >&2
        return 1
    fi
}

echo "=========================================="
echo "Maintenance-safe Deployment Pipeline"
echo "=========================================="
echo "Environment:  ${ENV}"
echo "App:          ${APP_NAME}"
echo "Image Tag:    ${IMAGE_TAG}"
echo "Release Tag:  ${RELEASE_TAG}"
echo "Cluster:      ${CLUSTER_NAME}"
echo "Service:      ${SERVICE_NAME}"
echo "=========================================="
echo ""

# ---------------------------------------------------------------------------
# Preflight: read and validate everything BEFORE anything is changed.
# ---------------------------------------------------------------------------
CURRENT_TASK_DEFINITION="$(
    aws_ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --query "services[0].taskDefinition" \
        --output text
)"
if [[ -z "${CURRENT_TASK_DEFINITION}" || "${CURRENT_TASK_DEFINITION}" == "None" ]]; then
    echo "Error: ECS service ${CLUSTER_NAME}/${SERVICE_NAME} was not found" >&2
    exit 1
fi

CURRENT_TASK_IMAGE="$(
    aws_ecs describe-task-definition \
        --task-definition "${CURRENT_TASK_DEFINITION}" \
        --query "taskDefinition.containerDefinitions[?name=='${CONTAINER_NAME}'].image | [0]" \
        --output text
)"
TASK_FAMILY="$(
    aws_ecs describe-task-definition \
        --task-definition "${CURRENT_TASK_DEFINITION}" \
        --query "taskDefinition.family" \
        --output text
)"
ORIGINAL_DESIRED_COUNT="$(
    aws_ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --query "services[0].desiredCount" \
        --output text
)"
ORIGINAL_CIRCUIT_BREAKER_ENABLED="$(
    aws_ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --query "services[0].deploymentConfiguration.deploymentCircuitBreaker.enable" \
        --output text | tr "[:upper:]" "[:lower:]"
)"
ORIGINAL_CIRCUIT_BREAKER_ROLLBACK="$(
    aws_ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --query "services[0].deploymentConfiguration.deploymentCircuitBreaker.rollback" \
        --output text | tr "[:upper:]" "[:lower:]"
)"

# In the floating model the task def must already track ${ENV}-latest, otherwise
# pushing the release image would not change what the service pulls. In the
# immutable model deploy-app.sh registers a revision pinned to the new tag, so
# the current image is expected to be the PREVIOUS version.
if [[ "${IMMUTABLE_DEPLOY}" != "true" && "${CURRENT_TASK_IMAGE}" != *":${ENV}-latest" ]]; then
    echo "Error: task definition must use the ${ENV}-latest image tag in the floating deploy model" >&2
    echo "Current image: ${CURRENT_TASK_IMAGE}" >&2
    echo "Run 'make ${SHORT_ENV}-infra-deploy' first, or set immutableDeploy in app.config.json." >&2
    exit 1
fi
if [[ ! "${ORIGINAL_DESIRED_COUNT}" =~ ^[0-9]+$ ]]; then
    echo "Error: Unexpected desired count '${ORIGINAL_DESIRED_COUNT}'" >&2
    exit 1
fi
if [[ "${ORIGINAL_CIRCUIT_BREAKER_ENABLED}" != "true" && "${ORIGINAL_CIRCUIT_BREAKER_ENABLED}" != "false" ]]; then
    echo "Error: Unexpected circuit-breaker enabled value '${ORIGINAL_CIRCUIT_BREAKER_ENABLED}'" >&2
    exit 1
fi
if [[ "${ORIGINAL_CIRCUIT_BREAKER_ROLLBACK}" != "true" && "${ORIGINAL_CIRCUIT_BREAKER_ROLLBACK}" != "false" ]]; then
    echo "Error: Unexpected circuit-breaker rollback value '${ORIGINAL_CIRCUIT_BREAKER_ROLLBACK}'" >&2
    exit 1
fi

# A zero desired count here almost always means a previous maintenance attempt
# failed closed. Bringing the app back up is still the intended end state, but
# it must be an explicit decision rather than a side effect of a retry.
TARGET_DESIRED_COUNT="${ORIGINAL_DESIRED_COUNT}"
if [[ "${TARGET_DESIRED_COUNT}" -eq 0 ]]; then
    if [[ "${MAINTENANCE_RESTORE_DESIRED_COUNT:-}" != "1" ]]; then
        echo "Error: Service already has desired count 0 — a previous deploy may have failed closed." >&2
        echo "Confirm the database state first, then retry with MAINTENANCE_RESTORE_DESIRED_COUNT=1." >&2
        exit 1
    fi
    TARGET_DESIRED_COUNT=1
fi

capture_and_gate_listeners
capture_and_disable_schedules

echo ""
echo "Step 1/6: Draining all application tasks behind the maintenance gates..."
# Captured BEFORE the scale-down so tasks already transitioning to STOPPING must
# still reach STOPPED before the migration begins.
PRE_DRAIN_TASKS="$(
    aws_ecs list-tasks \
        --cluster "${CLUSTER_NAME}" \
        --family "${TASK_FAMILY}" \
        --desired-status RUNNING \
        --query "taskArns" \
        --output text
)"
aws_ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_NAME}" \
    --desired-count 0 >/dev/null
SERVICE_DRAINED=true
if [[ -n "${PRE_DRAIN_TASKS}" && "${PRE_DRAIN_TASKS}" != "None" ]]; then
    # shellcheck disable=SC2086
    aws_ecs wait tasks-stopped --cluster "${CLUSTER_NAME}" --tasks ${PRE_DRAIN_TASKS}
fi
aws_ecs wait services-stable --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}"
wait_for_app_family_to_stop "${TASK_FAMILY}"

echo ""
echo "Step 2/6: Building and pushing the release image..."
SCHEDULES_MAY_START_NEW_IMAGE=true
"${SCRIPT_DIR}/build-and-push.sh" "${ENV}" "${IMAGE_TAG}"

echo ""
echo "Step 3/6: Verifying the published release digest..."
RELEASE_MANIFEST_DIGEST="$(
    aws_ecr describe-images \
        --repository-name "${ECR_REPO}" \
        --image-ids "imageTag=${RELEASE_TAG}" \
        --query "imageDetails[0].imageDigest" \
        --output text
)"
if [[ -z "${RELEASE_MANIFEST_DIGEST}" || "${RELEASE_MANIFEST_DIGEST}" == "None" ]]; then
    echo "Error: ECR did not return a digest for ${RELEASE_TAG}" >&2
    exit 1
fi
verify_published_release_tags
EXPECTED_RUNTIME_IMAGE_DIGEST="$(resolve_expected_runtime_digest)"
echo "Release manifest: ${RELEASE_MANIFEST_DIGEST}"
echo "Expected linux/amd64 runtime digest: ${EXPECTED_RUNTIME_IMAGE_DIGEST}"

echo ""
echo "Step 4/6: Starting one new-image task behind the maintenance gates..."
# Point the service at the release image while it is still at desired count 0.
# In the floating model this is a force-new-deployment on a service with no
# tasks; in the immutable model it registers the pinned task-def revision. Either
# way nothing starts until the scale-up below.
"${SCRIPT_DIR}/deploy-app.sh" "${ENV}"

# Do not let the ECS circuit breaker resurrect the previous revision after a
# breaking migration. The configured setting is restored in step 6.
aws_ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_NAME}" \
    --desired-count 1 \
    --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=false}" \
    --force-new-deployment >/dev/null
ROLLBACK_DISABLED=true
aws_ecs wait services-stable --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}"

CURRENT_TASK_DEFINITION="$(
    aws_ecs describe-services \
        --cluster "${CLUSTER_NAME}" \
        --services "${SERVICE_NAME}" \
        --query "services[0].taskDefinition" \
        --output text
)"
MAINTENANCE_TASK_ARN="$(
    aws_ecs list-tasks \
        --cluster "${CLUSTER_NAME}" \
        --service-name "${SERVICE_NAME}" \
        --desired-status RUNNING \
        --query "taskArns[0]" \
        --output text
)"
if [[ -z "${MAINTENANCE_TASK_ARN}" || "${MAINTENANCE_TASK_ARN}" == "None" ]]; then
    echo "Error: Service stabilized without a maintenance application task" >&2
    exit 1
fi
require_release_image_digest "${MAINTENANCE_TASK_ARN}"
verify_published_release_tags

echo ""
echo "Step 5/6: Running database migrations via ECS Exec..."
wait_for_exec_agent "${MAINTENANCE_TASK_ARN}"
require_only_maintenance_task_running "${MAINTENANCE_TASK_ARN}"
run_exec_job "migrate" "${MAINTENANCE_TASK_ARN}" "npx prisma migrate deploy"
verify_published_release_tags

if [[ -n "${MAINTENANCE_POST_MIGRATE_COMMAND:-}" ]]; then
    echo ""
    echo "Running post-migrate command: ${MAINTENANCE_POST_MIGRATE_COMMAND}"
    require_only_maintenance_task_running "${MAINTENANCE_TASK_ARN}"
    run_exec_job "post-migrate" "${MAINTENANCE_TASK_ARN}" "${MAINTENANCE_POST_MIGRATE_COMMAND}"
    verify_published_release_tags
fi

echo ""
echo "Step 6/6: Restoring service capacity and reopening traffic..."
if [[ "${TARGET_DESIRED_COUNT}" -ne 1 ]]; then
    aws_ecs update-service \
        --cluster "${CLUSTER_NAME}" \
        --service "${SERVICE_NAME}" \
        --desired-count "${TARGET_DESIRED_COUNT}" >/dev/null
    aws_ecs wait services-stable --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}"
fi

RUNNING_TASKS="$(
    aws_ecs list-tasks \
        --cluster "${CLUSTER_NAME}" \
        --service-name "${SERVICE_NAME}" \
        --desired-status RUNNING \
        --query "taskArns" \
        --output text
)"
if [[ -z "${RUNNING_TASKS}" || "${RUNNING_TASKS}" == "None" ]]; then
    echo "Error: Service stabilized without a running application task" >&2
    exit 1
fi
for running_task in ${RUNNING_TASKS}; do
    require_release_image_digest "${running_task}"
done

aws_ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_NAME}" \
    --deployment-configuration \
    "deploymentCircuitBreaker={enable=${ORIGINAL_CIRCUIT_BREAKER_ENABLED},rollback=${ORIGINAL_CIRCUIT_BREAKER_ROLLBACK}}" \
    >/dev/null
ROLLBACK_RESTORED=true
verify_published_release_tags
SERVICE_RESTORED=true

echo ""
echo "=========================================="
echo "Maintenance deployment complete!"
echo "=========================================="
echo "Task definition: ${CURRENT_TASK_DEFINITION}"
echo "Runtime digest:  ${RUNTIME_IMAGE_DIGEST}"
if [[ "${ENV}" == "production" ]]; then
    echo "Application URL: https://${APP_NAME}.labs.mapp.com"
else
    echo "Application URL: https://stg-${APP_NAME}.labs.mapp.com"
fi
