# Operations, backup, recovery, and upgrades

## Automated backup

Install `ops/backup.sh` on the Supabase host or a protected backup runner. Provide these environment variables through the university secret manager:

- `DATABASE_URL` — direct Postgres connection with backup privileges
- `SUPABASE_PUBLIC_URL` and `SUPABASE_SECRET_KEY` — used only to report job status
- `BACKUP_S3_URI` — off-site S3/R2/B2 prefix
- `AGE_RECIPIENT` — public encryption recipient
- standard AWS CLI credentials/endpoint variables

Run daily from a systemd timer. The script exports role globals and a custom-format database dump, verifies it with `pg_restore --list`, encrypts it with `age`, uploads it, and reports status to the admin dashboard. Apply an S3 lifecycle policy retaining `daily/` for 35 days and `monthly/` for 12 months. Deny public bucket access and enable object lock/versioning where available.

Alert if no successful `backup_runs` row exists in 26 hours. Back up the self-hosted Compose configuration and secrets separately in the university secret manager; database dumps do not replace secret/configuration recovery.

## Quarterly restore drill

1. Choose a recent daily and monthly object.
2. On an isolated network, set `AGE_IDENTITY_FILE` and run `ops/verify-backup.sh <s3-object>`.
3. Provision a disposable Postgres instance matching production major version.
4. Decrypt/extract the archive, apply `globals.sql`, then run `pg_restore --clean --if-exists --no-owner --dbname=<isolated-url> database.dump`.
5. Start a non-production Supabase stack against the restored database and verify Auth users, profiles, committees, RLS, search, and Realtime.
6. Record recovery time, data timestamp, checksum, failures, and corrective actions. Destroy the isolated copy according to university data-handling policy.

Never test a restore over the production database. A production restore requires an approved outage, a fresh pre-restore backup, written rollback criteria, and application maintenance mode.

## Monitoring

- Monitor container health, disk usage, Postgres connections/locks/replication, TLS expiry, SMTP failures, backup age, Auth error rate, and Vercel function errors.
- Enable Supabase's optional Logflare/Vector override only after sizing additional CPU/RAM/disk. Infrastructure logs remain in protected operations tooling, not the portal UI.
- Review immutable `activity_log` events for administrative and governance changes.

## Upgrade and rollback

1. Review Supabase breaking changes and the tagged self-hosted release notes, especially database major-version, Envoy, Auth URL, and Realtime changes.
2. Rehearse the upgrade on a restored backup in staging.
3. Pin the new Compose release and image digests, take a verified backup, schedule downtime if required, and apply application migrations before code that depends on them.
4. Run RLS, Auth, search, Realtime, backup, and browser smoke tests.
5. Roll back application code through Vercel. Roll back schema only with an explicitly reviewed down migration or database restore; never use `git reset` or destructive ad-hoc SQL as an operational rollback.

Rotate publishable/secret/JWT/asymmetric keys and database/SMTP/S3 credentials on the university schedule and immediately after suspected exposure. Update Supabase and Vercel atomically, then invalidate sessions when the affected credential permits it.
