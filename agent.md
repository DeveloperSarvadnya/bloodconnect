# BloodConnect — Project Handoff Prompt

Paste this whole document as context when starting a new agent session to continue this project. It describes what exists, how it's built, and what's left.

---

## Project Overview

**BloodConnect** — a real-time blood donation & emergency response platform connecting donors, hospitals, and blood banks. Built for a Cloud Computing & DevOps college subject; the grading emphasis is on the DevOps pipeline, not just the app.

- **Repo**: https://github.com/DeveloperSarvadnya/bloodconnect
- **Stack**: Next.js 14 (App Router, TypeScript), Tailwind CSS, Zustand, Supabase (Postgres, Auth, Realtime), Leaflet/OpenStreetMap
- **DevOps**: Docker, Kubernetes (k3s — NOT AWS EKS, deliberately, to avoid EKS's ~$0.10/hr control-plane cost), Jenkins, Terraform, Ansible, AWS EC2, SonarQube, OWASP ZAP, Prometheus, Grafana, GitHub Actions

## Mandatory working convention

**Every code change must be validated before being considered done**: run `npm run lint` and a full `npm run build` (with placeholder Supabase env vars if real ones aren't available) and confirm both pass clean before handing anything off. This project's entire debugging history has been real bugs caught exactly this way (missing deps, frozen static routes, silent RLS failures, a unique-constraint collision) — never claim a fix works without actually running it.

## What's Already Built (Complete)

### Application
- Donor registration/login, profile with blood group + geolocation + availability toggle
- Hospital registration/login, can post/withdraw blood requests
- Donor dashboard: nearby compatible requests (50km radius, server-filtered via `/api/requests/nearby`), shows requesting hospital's name/city/distance, pledge / withdraw pledge, Google Maps directions link (free URL scheme, no API key) once pledged
- Hospital dashboard: post requests, live pledge-count badges (no click required), expandable pledge list with donor contact info, expandable "nearby matched donors" view (`/api/donors/match`), withdraw a request
- Public live map (`/map`) — all open requests + blood banks + donation camps, realtime updates, hospital name in popups
- Admin CSV bulk upload for blood bank stock
- Forgot/reset password flow using Supabase's built-in secure recovery (not a custom/hardcoded scheme)
- Prometheus metrics (`/api/metrics`, force-dynamic — was previously frozen at build time, now fixed) via a `withMetrics()` wrapper applied to all API routes; Grafana dashboard pre-provisioned
- Realtime in-app notifications (not email/SMS — out of scope) for hospitals when a donor pledges or withdraws

### Database (Supabase)
- Full schema in `supabase/schema.sql`, RLS policies on every table
- Migrations in `supabase/migrations/` (run manually in Supabase SQL Editor — **not** auto-applied):
  - `001_add_cancelled_status.sql` — adds `'cancelled'` to `blood_requests.status`
  - `002_donor_can_withdraw_pledge.sql` — grants donors UPDATE on their own `donation_responses` row (required for pledge withdrawal/re-pledge)
- **Known constraint to respect**: `donation_responses` has `unique(request_id, donor_id)` — any code touching pledges must `upsert` with `onConflict: 'request_id,donor_id'`, never a plain `insert`, or it will silently fail for a donor who previously withdrew.

### DevOps Pipeline
- `Dockerfile` — multi-stage, Node 22-alpine, non-root runtime
- `docker-compose.yml` — app + Prometheus + Grafana + SonarQube, one network
- `k8s/` — Kustomize base + dev/staging/prod overlays, Deployment/Service(NodePort 30080)/ConfigMap/HPA
- `ansible/playbooks/` — `provision.yml` (Docker+firewall), `k8s_provision.yml` (installs k3s), `k8s_deploy.yml` (applies kustomize overlay + sets image tag + waits for healthy rollout), `deploy.yml` (legacy plain-Docker path, kept for reference only)
- `terraform/` — EC2 + security group module, separate dev/staging/prod environments, remote S3+DynamoDB state
- `Jenkinsfile` — full pipeline: lint → build → SonarQube scan → quality gate → Docker build/push → Terraform → Ansible (provision + k3s + deploy) → health check → OWASP ZAP scan
- `.github/workflows/ci.yml` — lint/build + docker-build-check on every push, both jobs currently green
- `sonar-project.properties`, `security/zap/zap-rules.tsv` — scanner configs

### Presentation materials
- `BloodConnect_Presentation.pptx` — 3 slides (title, objectives, architecture diagram with each Ops/Delivery tool annotated with *why* it's needed)
- Architecture diagram built with Graphviz, mirrors a reference diagram style the professor liked
- `PRESENTATION_NOTES.md` — talking points for defending the project live

## What's Pending

> ⚠️ The user intended to attach a specific current to-do list here and it didn't come through — **merge in whatever list they provide** on top of what's below; the items below are what's confirmed outstanding from the conversation history, not necessarily the complete picture.

1. **AWS deployment has not been confirmed completed.** Per `SETUP_GUIDE.md` steps 6–8:
   - Step 6: Terraform hasn't been confirmed run against real AWS (`terraform apply` for the `dev` environment) — needs a verified Ubuntu 22.04 AMI ID for `ap-south-1` (AMI IDs drift over time) and an existing EC2 key pair
   - Step 7: Ansible provisioning + k3s install + first deploy to the real EC2 instance not confirmed done
   - Step 8: Jenkins (local, in Docker) not confirmed set up — plugins, SonarQube integration, 6 required credentials (`dockerhub-creds`, `aws-creds`, `supabase-url`, `supabase-anon-key`, `sonar-token`, SSH key), and a Pipeline job pointed at the GitHub repo
2. **Both DB migrations must be run** in the Supabase SQL Editor before the live app will work correctly end-to-end, if not already done: `001_add_cancelled_status.sql`, `002_donor_can_withdraw_pledge.sql`.
3. **Fill in real team member names/registration numbers** on the title/closing slides of the pptx (currently placeholders).
4. Nothing else is a known open bug as of this handoff — the donor pledge button issue (silent failure on re-pledge after withdrawal, due to the unique-constraint collision) was fixed in the same session this document was written.

## Key files an agent should read first

- `README.md` — full project structure and setup reference
- `SETUP_GUIDE.md` — the step-by-step a human would follow; steps 6–8 are what's pending
- `supabase/schema.sql` + `supabase/migrations/` — data model and required manual migrations
- `src/lib/constants.ts` — shared values (e.g. match radius) that must stay consistent across donor/hospital views
- `src/lib/withMetrics.ts` — pattern for instrumenting any new API route