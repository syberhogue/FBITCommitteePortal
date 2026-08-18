#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 s3://bucket/path/to/backup.tar.gz.age" >&2
  exit 1
fi
if [[ -z "${AGE_IDENTITY_FILE:-}" ]]; then
  echo "AGE_IDENTITY_FILE must point to the restore private key." >&2
  exit 1
fi

verify_object="$1"
verify_tmp="$(mktemp -d)"
cleanup() { rm -rf -- "${verify_tmp}"; }
trap cleanup EXIT

aws s3 cp --only-show-errors "${verify_object}" "${verify_tmp}/backup.tar.gz.age"
shasum -a 256 "${verify_tmp}/backup.tar.gz.age"
age --decrypt --identity "${AGE_IDENTITY_FILE}" --output "${verify_tmp}/backup.tar.gz" "${verify_tmp}/backup.tar.gz.age"
tar -C "${verify_tmp}" -xzf "${verify_tmp}/backup.tar.gz"
test -s "${verify_tmp}/globals.sql"
pg_restore --list "${verify_tmp}/database.dump" >/dev/null
echo "Backup archive is readable and contains valid globals and custom-format database dumps."
