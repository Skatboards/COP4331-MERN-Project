#!/usr/bin/env bash

set -Eeuo pipefail

readonly ACTION="${1:-}"
readonly RELEASE_SHA="${2:-}"
readonly RELEASE_ENV_ID="${3:-}"

APP_ROOT="$(git rev-parse --show-toplevel)"
readonly APP_ROOT
readonly COMPOSE_FILE="$APP_ROOT/compose.prod.yaml"
readonly STATE_DIR="$APP_ROOT/.deploy"
readonly ENV_DIR="$STATE_DIR/environments"
readonly LAST_SUCCESSFUL_FILE="$STATE_DIR/last-successful-release"
readonly PENDING_PREVIOUS_FILE="$STATE_DIR/pending-previous-release"
readonly REPLACEMENT_MARKER="$STATE_DIR/replacement-started"

STATE_SHA=""
STATE_ENV_ID=""

# Restrict release references to immutable full commit SHAs so Git checkouts and
# image tags cannot resolve an ambiguous or malformed deployment target.
validate_sha() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]]
}

# Accept only workflow-generated environment IDs, preventing path traversal and
# ensuring a release is paired with a uniquely versioned runtime configuration.
validate_env_id() {
  [[ "$1" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]
}

# Keep environment-file path construction consistent for deployment, rollback,
# diagnostics, and cleanup operations.
environment_file() {
  printf '%s/%s.env\n' "$ENV_DIR" "$1"
}

# Load and validate a persisted release/configuration pair before trusting it
# as a deployment or rollback target.
read_release_state() {
  local source="$1"
  local extra=""

  STATE_SHA=""
  STATE_ENV_ID=""
  [[ -f "$source" ]] || return 0
  read -r STATE_SHA STATE_ENV_ID extra < "$source" || true
  if [[ -n "$extra" ]] || ! validate_sha "$STATE_SHA" || ! validate_env_id "$STATE_ENV_ID"; then
    printf 'Invalid deployment state in %s\n' "$source" >&2
    return 1
  fi
}

# Replace state atomically so an interrupted write cannot leave rollback
# metadata partially written or unusable.
write_release_state() {
  local destination="$1"
  local sha="$2"
  local env_id="$3"
  local temporary

  temporary="$(mktemp "$STATE_DIR/.state.XXXXXX")"
  chmod 600 "$temporary"
  printf '%s %s\n' "$sha" "$env_id" > "$temporary"
  mv -f "$temporary" "$destination"
}

# Run every Compose operation with the exact image SHA and protected runtime
# environment belonging to that release, including during rollback.
compose_for() {
  local sha="$1"
  local env_id="$2"
  shift 2

  local env_file
  env_file="$(environment_file "$env_id")"
  if [[ ! -f "$env_file" ]]; then
    printf 'Missing protected runtime environment for release %s\n' "$sha" >&2
    return 1
  fi

  IMAGE_TAG="$sha" docker compose \
    --env-file "$env_file" \
    -f "$COMPOSE_FILE" \
    "$@"
}

# Confirm that code, configuration, and both application images are available
# before recording or attempting a rollback to a release.
require_release_assets() {
  local sha="$1"
  local env_id="$2"

  validate_sha "$sha" || {
    printf 'Invalid release SHA in deployment state\n' >&2
    return 1
  }
  validate_env_id "$env_id" || {
    printf 'Invalid runtime environment ID in deployment state\n' >&2
    return 1
  }
  git cat-file -e "${sha}^{commit}"
  [[ -f "$(environment_file "$env_id")" ]] || {
    printf 'Missing protected runtime environment for rollback release %s\n' "$sha" >&2
    return 1
  }
  docker image inspect "sweeple-backend:$sha" >/dev/null
  docker image inspect "sweeple-client:$sha" >/dev/null
}

# Capture host resources and container status to make failures diagnosable on
# the memory- and disk-constrained production droplet.
show_diagnostics() {
  local sha="${1:-}"
  local env_id="${2:-}"

  printf '%s\n' 'Filesystem usage:'
  df -h "$APP_ROOT" || true
  printf '%s\n' 'Memory usage:'
  free -h || true
  printf '%s\n' 'Docker disk usage:'
  docker system df || true
  printf '%s\n' 'Current container status:'
  if validate_sha "$sha" && validate_env_id "$env_id" && [[ -f "$(environment_file "$env_id")" ]]; then
    compose_for "$sha" "$env_id" ps || true
  else
    docker ps --all || true
  fi
}

# Validate and build the requested release while preserving the last successful
# release, then replace the stack only after all sequential builds succeed.
deploy_release() {
  local current_sha previous_sha previous_env_id

  validate_sha "$RELEASE_SHA" || {
    printf 'DEPLOY_SHA must be a full 40-character lowercase commit SHA\n' >&2
    return 1
  }
  validate_env_id "$RELEASE_ENV_ID" || {
    printf 'Invalid runtime environment ID\n' >&2
    return 1
  }
  current_sha="$(git rev-parse HEAD)"
  [[ "$current_sha" == "$RELEASE_SHA" ]] || {
    printf 'Checked-out commit does not match DEPLOY_SHA\n' >&2
    return 1
  }
  [[ -f "$(environment_file "$RELEASE_ENV_ID")" ]] || {
    printf 'Missing protected runtime environment for target release\n' >&2
    return 1
  }

  install -d -m 700 "$STATE_DIR" "$ENV_DIR"
  if [[ -f "$REPLACEMENT_MARKER" || -f "$PENDING_PREVIOUS_FILE" ]]; then
    printf '%s\n' 'Unfinished deployment state exists; resolve or roll it back before deploying again.' >&2
    return 1
  fi
  read_release_state "$LAST_SUCCESSFUL_FILE"
  previous_sha="$STATE_SHA"
  previous_env_id="$STATE_ENV_ID"
  if [[ -n "$previous_sha" ]]; then
    require_release_assets "$previous_sha" "$previous_env_id"
    write_release_state "$PENDING_PREVIOUS_FILE" "$previous_sha" "$previous_env_id"
  else
    rm -f "$PENDING_PREVIOUS_FILE"
  fi
  rm -f "$REPLACEMENT_MARKER"

  compose_for "$RELEASE_SHA" "$RELEASE_ENV_ID" config --quiet
  compose_for "$RELEASE_SHA" "$RELEASE_ENV_ID" build backend
  compose_for "$RELEASE_SHA" "$RELEASE_ENV_ID" build client

  show_diagnostics "$previous_sha" "$previous_env_id"
  write_release_state "$REPLACEMENT_MARKER" "$RELEASE_SHA" "$RELEASE_ENV_ID"
  compose_for "$RELEASE_SHA" "$RELEASE_ENV_ID" up \
    --detach \
    --no-build \
    --remove-orphans \
    --wait \
    --wait-timeout 300
}

# Restore the last successful code, images, and runtime environment when a
# replacement fails; leave the existing stack alone if replacement never began.
rollback_release() {
  local previous_sha previous_env_id

  printf '%s\n' 'Deployment failed; collecting target release status and logs.'
  show_diagnostics "$RELEASE_SHA" "$RELEASE_ENV_ID"
  if validate_sha "$RELEASE_SHA" && validate_env_id "$RELEASE_ENV_ID" && [[ -f "$(environment_file "$RELEASE_ENV_ID")" ]]; then
    compose_for "$RELEASE_SHA" "$RELEASE_ENV_ID" logs --no-color --tail 200 || true
  fi

  if [[ ! -f "$REPLACEMENT_MARKER" ]]; then
    printf '%s\n' 'Container replacement had not started; the existing stack was left unchanged.'
    read_release_state "$LAST_SUCCESSFUL_FILE"
    if [[ -n "$STATE_SHA" ]] && git cat-file -e "${STATE_SHA}^{commit}"; then
      git checkout --detach --force "$STATE_SHA"
      printf 'Restored the checkout to the running release %s\n' "$STATE_SHA"
    fi
    rm -f "$PENDING_PREVIOUS_FILE"
    printf '%s\n' 'ROLLBACK_PERFORMED=false'
    return 0
  fi

  if [[ ! -f "$PENDING_PREVIOUS_FILE" ]]; then
    printf '%s\n' 'No previous successful release exists; automatic rollback is unavailable.' >&2
    return 1
  fi
  read_release_state "$PENDING_PREVIOUS_FILE"
  previous_sha="$STATE_SHA"
  previous_env_id="$STATE_ENV_ID"
  require_release_assets "$previous_sha" "$previous_env_id"

  git checkout --detach --force "$previous_sha"
  [[ "$(git rev-parse HEAD)" == "$previous_sha" ]]
  compose_for "$previous_sha" "$previous_env_id" config --quiet
  compose_for "$previous_sha" "$previous_env_id" up \
    --detach \
    --no-build \
    --remove-orphans \
    --wait \
    --wait-timeout 300
  rm -f "$REPLACEMENT_MARKER" "$PENDING_PREVIOUS_FILE"
  printf 'Rolled back to %s\n' "$previous_sha"
  printf '%s\n' 'ROLLBACK_PERFORMED=true'
}

# Mark a release successful only after CI's public health check, then remove
# stale configuration and build data while retaining the immediate rollback.
finalize_release() {
  local current_sha previous_env_id env_file marker_sha marker_env_id

  validate_sha "$RELEASE_SHA" || return 1
  validate_env_id "$RELEASE_ENV_ID" || return 1
  current_sha="$(git rev-parse HEAD)"
  [[ "$current_sha" == "$RELEASE_SHA" ]]

  read_release_state "$REPLACEMENT_MARKER"
  marker_sha="$STATE_SHA"
  marker_env_id="$STATE_ENV_ID"
  [[ "$marker_sha" == "$RELEASE_SHA" && "$marker_env_id" == "$RELEASE_ENV_ID" ]]

  previous_env_id=""
  if [[ -f "$PENDING_PREVIOUS_FILE" ]]; then
    read_release_state "$PENDING_PREVIOUS_FILE"
    previous_env_id="$STATE_ENV_ID"
  fi
  write_release_state "$LAST_SUCCESSFUL_FILE" "$RELEASE_SHA" "$RELEASE_ENV_ID"
  rm -f "$REPLACEMENT_MARKER" "$PENDING_PREVIOUS_FILE"

  # Keep the current and immediately previous runtime configurations. The
  # image prune below removes dangling layers only, so both SHA-tagged releases
  # remain available for rollback.
  shopt -s nullglob
  for env_file in "$ENV_DIR"/*.env; do
    case "$(basename "$env_file")" in
      "$RELEASE_ENV_ID.env"|"$previous_env_id.env") ;;
      *) rm -f -- "$env_file" ;;
    esac
  done
  docker image prune --force --filter 'until=168h' || true
  docker builder prune --force --filter 'until=168h' || true
  printf 'Recorded %s as the last successful release\n' "$RELEASE_SHA"
}

case "$ACTION" in
  deploy)
    deploy_release
    ;;
  rollback)
    rollback_release
    ;;
  finalize)
    finalize_release
    ;;
  *)
    printf 'Usage: %s {deploy|rollback|finalize} <release-sha> <environment-id>\n' "$0" >&2
    exit 2
    ;;
esac
