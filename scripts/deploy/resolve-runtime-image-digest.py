#!/usr/bin/env python3
"""Resolve the linux/amd64 runtime digest from an ECR image manifest.

`aws ecr describe-images` reports the digest of whatever the tag points at. For
a buildx push that is an OCI image index (manifest list), while ECS may report
the digest of the child manifest it actually pulled. This reads the manifest on
stdin and prints the one linux/amd64 descriptor's digest, so the maintenance
deploy can compare like with like.

A manifest with no `manifests` key is a plain single-platform image: the root
digest is the runtime digest.
"""

from __future__ import annotations

import json
import sys
from typing import Any


def resolve_runtime_digest(root_digest: str, manifest: dict[str, Any]) -> str:
    descriptors = manifest.get("manifests")
    if descriptors is None:
        return root_digest

    matches = [
        descriptor.get("digest")
        for descriptor in descriptors
        if descriptor.get("platform", {}).get("os") == "linux"
        and descriptor.get("platform", {}).get("architecture") == "amd64"
    ]
    if len(matches) != 1 or not isinstance(matches[0], str):
        raise ValueError(
            f"Expected one linux/amd64 image descriptor, found {len(matches)}"
        )
    return matches[0]


def main() -> int:
    if len(sys.argv) != 2:
        print(
            "Usage: resolve-runtime-image-digest.py <root-digest>",
            file=sys.stderr,
        )
        return 2

    try:
        manifest = json.load(sys.stdin)
        print(resolve_runtime_digest(sys.argv[1], manifest))
    except (json.JSONDecodeError, TypeError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
