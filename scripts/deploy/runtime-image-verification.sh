#!/usr/bin/env bash

# Shared image-identity helpers for the maintenance deploy path.
#
# Sourced, never executed. Kept in its own file so the contract test can run
# `bash -n` over it independently and so any future deploy script can reuse the
# same two rules.

# ECS/Fargate can report either the OCI index (manifest-list) digest or the
# selected linux/amd64 child-manifest digest for the same running image,
# depending on the pull path. Only those two verified release digests are
# accepted — anything else means the task is not running this release.
runtime_image_digest_matches_release() {
    local actual_digest="${1:-}"
    local expected_child_digest="${2:-}"
    local expected_root_digest="${3:-}"

    [[ -n "${actual_digest}" && "${actual_digest}" != "None" ]] &&
        [[ "${actual_digest}" == "${expected_child_digest}" ||
            "${actual_digest}" == "${expected_root_digest}" ]]
}

# Accepting the root-index digest is only safe once the live task confirms that
# Fargate selected the same platform the deployment pipeline resolved. Every
# Labs app builds and runs linux/amd64 (build-and-push.sh pins
# `--platform linux/amd64`).
runtime_platform_matches_release() {
    local platform_family="${1:-}"
    local cpu_architecture="${2:-}"

    [[ "${platform_family}" == "Linux" || "${platform_family}" == "LINUX" ]] &&
        [[ "${cpu_architecture}" == "x86_64" ]]
}
