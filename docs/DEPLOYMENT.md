# Production deployment: Vercel + on-prem Supabase

This runbook targets a university-managed Linux host for Supabase and Vercel for Next.js. Replace every `<placeholder>` before launch.

## 1. Provision and secure the Supabase host

1. Allocate at least 4 CPU cores, 8 GB RAM, and 80 GB SSD; use additional capacity when enabling the optional logs stack.
2. Install a supported Linux distribution, current Docker Engine with Compose, `git`, `openssl`, `jq`, PostgreSQL client tools, `age`, AWS CLI, and host monitoring.
3. Restrict SSH to the operations network, disable password SSH, enable unattended security updates, and allow inbound 80/443 only through the approved university ingress. PostgreSQL, Studio, and Envoy admin port 9901 must not be public.
4. Create DNS:
   - `app.<institution-domain>` → Vercel
   - `api.<institution-domain>` → university ingress/on-prem host
5. Follow the current official Supabase Docker installer or clone a tagged Supabase release. Record the Git tag and all image digests in the change record; do not deploy floating `latest` images.
6. Run the supplied key generators. Replace every example database, dashboard, JWT, publishable, secret, and asymmetric signing key. Store the production `.env` in the university secret manager, not this repository.
7. Enable the Envoy override and Caddy (or the approved reverse proxy) override. Configure the proxy for WebSockets and forwarded headers. Never expose Envoy port 9901; its config dump contains secrets.
8. Set:
   - `SUPABASE_PUBLIC_URL=https://api.<institution-domain>`
   - `API_EXTERNAL_URL=https://api.<institution-domain>/auth/v1`
   - `SITE_URL=https://app.<institution-domain>`
   - Auth redirect allow-list: `https://app.<institution-domain>/auth/callback`
   - JWT expiry: 900 seconds; refresh-token rotation enabled
9. Configure production SMTP variables, a verified `no-reply@<institution-domain>` sender, SPF/DKIM/DMARC, email confirmation, invite/reset templates, and suitable rate limits.
10. Start the stack and confirm health through HTTPS. Keep Studio behind VPN and separate authentication.

The July/August 2026 Supabase changes make Envoy the default self-hosted gateway and require `/auth/v1` in `API_EXTERNAL_URL`. Re-check the [breaking-change feed](https://supabase.com/changelog?types=breaking-change), [Docker guide](https://supabase.com/docs/guides/self-hosting/docker), and [HTTPS proxy guide](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https) before each upgrade.

## 2. Apply the database

1. From a protected deployment runner with direct database access, install this repository with `npm ci`.
2. Back up the target database before any upgrade.
3. Inspect the pinned CLI commands with `npx supabase db --help` and `npx supabase migration --help` because CLI flags change.
4. Apply every file in `supabase/migrations` in order to the production Postgres database using the pinned CLI migration command or `psql` under a migration role.
5. Do **not** run `supabase/seed.sql` in production.
6. Insert the real university domain before enabling signup:
   `insert into public.allowed_email_domains(domain) values ('<institution-domain>');`
7. Configure the `before_user_created` hook URI as `pg-functions://postgres/private/hook_restrict_signup_by_email_domain` in the self-hosted Auth service.
8. Register `activity_log` and `action_items` for Realtime if the production publication is not created by the migration.
9. Run schema/RLS smoke tests and the Supabase database/security advisors available for the deployed version.

### Bootstrap the first administrator

1. Sign up with an allowed university email and confirm the email.
2. From a protected SQL session, run:
   `update public.profiles set status='active', global_role='admin', person_category='admin' where email='<admin-email>';`
3. Sign in, open `/admin`, create a second administrator, and verify both accounts before launch.

## 3. Deploy Next.js to Vercel

1. Import this GitHub repository in Vercel and select the Next.js preset.
2. Use Node.js 22 and `npm run build`; do not override the output directory.
3. Add production variables:
   - `NEXT_PUBLIC_SUPABASE_URL=https://api.<institution-domain>`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>`
   - `SUPABASE_SECRET_KEY=<secret-key>` (server-only)
   - `NEXT_PUBLIC_APP_URL=https://app.<institution-domain>`
   - `NEXT_PUBLIC_APP_NAME=FBIT Committee Portal`
   - `NEXT_PUBLIC_INSTITUTION_NAME=<institution-name>`
   - `SUPPORT_EMAIL=<support-email>`
   - `DEPLOYMENT_ENV=production`
4. Never create a `NEXT_PUBLIC_` copy of the secret key. Vercel functions use only the HTTPS Auth/Data APIs; do not add the Postgres connection string.
5. Point the application DNS record to Vercel, verify TLS, then update `SITE_URL` and redirect allow-lists to the final domain.
6. Give preview environments a separate non-production Supabase instance. Do not copy production backend variables into previews.

## 4. Launch checks

- Confirm allowed-domain signup, email verification, pending state, approval, password reset, and suspension.
- Exercise the full RLS matrix with test accounts and verify an unassigned member cannot fetch another committee through the REST API.
- Confirm Realtime updates, CSV export, audit events, SMTP delivery, security headers, and that no secret appears in browser bundles.
- Complete one encrypted off-site backup and isolated restore verification before accepting production data.
