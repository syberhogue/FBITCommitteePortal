#!/usr/bin/env bash
set -Eeuo pipefail

required=(DATABASE_URL SUPABASE_PUBLIC_URL SUPABASE_SECRET_KEY BACKUP_S3_URI AGE_RECIPIENT)
for backup_var in "${required[@]}"; do
  if [[ -z "${!backup_var:-}" ]]; then
    echo "Missing required environment variable: ${backup_var}" >&2
    exit 1
  fi
done

backup_started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_day="$(date -u +%d)"
backup_class="daily"
[[ "${backup_day}" == "01" ]] && backup_class="monthly"
backup_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
backup_tmp="$(mktemp -d)"
backup_base="fbit-portal-${backup_stamp}"
backup_object="${BACKUP_S3_URI%/}/${backup_class}/${backup_base}.tar.gz.age"

cleanup() {
  rm -rf -- "${backup_tmp}"
}
trap cleanup EXIT

report_run() {
  local backup_payload="$1"
  curl --fail-with-body --silent --show-error \
    -X POST "${SUPABASE_PUBLIC_URL%/}/rest/v1/backup_runs?on_conflict=id" \
    -H "apikey: ${SUPABASE_SECRET_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    --data "${backup_payload}" >/dev/null
}

failure_report() {
  local backup_exit=$?
  local backup_message="Backup command failed with exit code ${backup_exit}"
  report_run "{\"id\":\"${backup_id}\",\"status\":\"failed\",\"started_at\":\"${backup_started}\",\"finished_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"retention_class\":\"${backup_class}\",\"error_message\":\"${backup_message}\"}" || true
  exit "${backup_exit}"
}
trap failure_report ERR

report_run "{\"id\":\"${backup_id}\",\"status\":\"running\",\"started_at\":\"${backup_started}\",\"retention_class\":\"${backup_class}\"}"

pg_dumpall --database="${DATABASE_URL}" --globals-only --no-role-passwords > "${backup_tmp}/globals.sql"
pg_dump --dbname="${DATABASE_URL}" --format=custom --no-owner --file="${backup_tmp}/database.dump"
pg_restore --list "${backup_tmp}/database.dump" >/dev/null

tar -C "${backup_tmp}" -czf "${backup_tmp}/${backup_base}.tar.gz" globals.sql database.dump
age --recipient "${AGE_RECIPIENT}" --output "${backup_tmp}/${backup_base}.tar.gz.age" "${backup_tmp}/${backup_base}.tar.gz"

backup_checksum="$(shasum -a 256 "${backup_tmp}/${backup_base}.tar.gz.age" | awk '{print $1}')"
backup_size="$(wc -c < "${backup_tmp}/${backup_base}.tar.gz.age" | tr -d ' ')"
aws s3 cp --only-show-errors "${backup_tmp}/${backup_base}.tar.gz.age" "${backup_object}"

report_run "{\"id\":\"${backup_id}\",\"status\":\"succeeded\",\"started_at\":\"${backup_started}\",\"finished_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"object_key\":\"${backup_object}\",\"size_bytes\":${backup_size},\"checksum_sha256\":\"${backup_checksum}\",\"retention_class\":\"${backup_class}\"}"
echo "Backup uploaded: ${backup_object} (${backup_size} bytes, sha256 ${backup_checksum})"
