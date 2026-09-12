# BloodConnect

**A Real-Time Blood Donation & Emergency Resource Locator — Cloud-Native Deployment with CI/CD Automation**

A platform connecting blood donors, hospitals, and blood banks in real time.
Hospitals post urgent requests; compatible donors nearby are matched instantly
and notified live. Built with Next.js + Supabase, deployed to AWS via a full
Docker → Jenkins → Terraform → Ansible pipeline.

## Features

### For Donors
- Register with blood group, location, and availability status
- See nearby urgent requests you're compatible to donate to (blood-group compatibility matching)
- Toggle availability on/off
- Pledge to donate on a specific request

### For Hospitals
- Post urgent blood requests (blood group, units needed, urgency level)
- View real-time list of your posted requests and their status
- System automatically finds and ranks compatible nearby donors by distance

### For Admins
- Bulk-upload blood bank inventory via CSV
- Manage donation camps
- Manage emergency contact numbers

### Public
- Live map showing active requests, blood bank stock, and upcoming donation camps
- Requests appear on the map in real time via Supabase Realtime — no refresh needed
- Emergency contact numbers always visible

## Tech Stack

**Application**
- Next.js 14 (App Router), React, TypeScript
- Tailwind CSS
- Zustand (state management)
- Supabase (PostgreSQL, Auth, Realtime)
- Leaflet.js + OpenStreetMap

**Cloud & DevOps**
- Docker (multi-stage build, non-root runtime, built-in health check)
- Kubernetes / k3s (orchestration — self-healing, per-environment replica counts, CPU-based autoscaling via HPA)
- Jenkins (CI/CD pipeline: lint → build → SonarQube scan → quality gate → Docker push → Terraform → Ansible → k3s deploy → health check → OWASP ZAP scan)
- Terraform (infrastructure as code, isolated `dev` / `staging` / `prod` environments, remote S3+DynamoDB state)
- Ansible (idempotent host provisioning, k3s installation, and Kubernetes deployment via Kustomize overlays)
- AWS EC2 (Free Tier eligible `t2.micro`/`t3.small` — hosts the k3s node)
- GitHub Actions (parallel CI check on every PR)

**Observability & Quality**
- Prometheus (scrapes `/api/metrics` — request rate, latency, process memory, plus a domain metric: blood requests created by urgency/blood group)
- Grafana (pre-provisioned dashboard: HTTP traffic, p95 latency, blood request trends, app up/down)
- SonarQube (static code analysis + quality gate — the Jenkins pipeline aborts if the gate fails)
- OWASP ZAP (baseline security scan against the deployed instance, HTML/JSON report archived by Jenkins)

## Project Structure

```
bloodconnect/
├── src/
│   ├── app/
│   │   ├── donor/            # Donor dashboard
│   │   ├── hospital/         # Hospital dashboard
│   │   ├── admin/            # Admin CSV bulk upload
│   │   ├── auth/              # Login / register
│   │   ├── map/               # Public live map
│   │   └── api/
│   │       ├── health/        # Used by Docker/Ansible/Jenkins health checks
│   │       ├── requests/      # Blood request CRUD
│   │       ├── donors/match/  # Compatibility + proximity matching engine
│   │       └── stock/         # Blood bank stock CRUD + bulk upload
│   ├── components/map/        # Leaflet map component
│   ├── lib/                   # Supabase clients, geo distance helper
│   ├── store/                 # Zustand store
│   └── types/                 # Shared TypeScript types + compatibility rules
├── supabase/
│   └── schema.sql             # Full DB schema + RLS policies + realtime config
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # Local dev
├── Jenkinsfile                # Full CI/CD pipeline definition
├── terraform/
│   ├── modules/ec2/           # Reusable EC2 + security group + EIP module
│   └── environments/
│       ├── dev/
│       ├── staging/
│       └── prod/
├── ansible/
│   ├── inventories/{dev,staging,prod}/hosts.yml
│   └── playbooks/
│       ├── provision.yml      # Installs Docker + firewall rules on a fresh host
│       ├── k8s_provision.yml  # Installs k3s on the host
│       ├── k8s_deploy.yml     # Applies kustomize overlay, sets image tag, waits for rollout
│       └── deploy.yml         # [legacy] plain single-container Docker deploy, kept for reference
├── k8s/
│   ├── base/                  # Deployment, Service (NodePort), ConfigMap, HPA
│   └── overlays/{dev,staging,prod}/  # per-environment namespace + replica count
├── scripts/jenkins/
│   └── bootstrap-tf-backend.sh  # One-time S3+DynamoDB state backend setup
├── monitoring/
│   ├── prometheus/prometheus.yml       # Scrape config — targets bloodconnect:3000/api/metrics
│   └── grafana/provisioning/           # Auto-provisioned datasource + dashboard
├── sonar-project.properties            # SonarQube scanner config
├── security/zap/zap-rules.tsv          # OWASP ZAP baseline scan rule thresholds
└── .github/workflows/ci.yml   # PR-time lint/build/docker-build-check
```

## CI/CD Pipeline Flow

```
Git push
   │
   ▼
Jenkins triggered
   │
   ├── npm ci, lint, build                       (CI checks)
   ├── sonar-scanner                              (static code analysis)
   ├── waitForQualityGate                         (aborts pipeline if gate fails)
   ├── docker build + push to Docker Hub          (containerize)
   ├── terraform init/plan/apply (per environment) (provision AWS infra)
   ├── ansible-playbook provision.yml              (install Docker + firewall on host)
   ├── ansible-playbook k8s_provision.yml          (install k3s on host)
   ├── ansible-playbook k8s_deploy.yml             (apply kustomize overlay, set image, wait for rollout)
   ├── curl :30080/api/health                      (verify deployment)
   └── zap-baseline.py                             (security scan, report archived)
           │
           ├── success → done
           └── failure → re-run with ROLLBACK_TAG=<previous build number>
```

## Local Development

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project URL + anon key
npm run dev
# open http://localhost:3000
```

Apply the schema to your Supabase project:
```bash
# In the Supabase SQL editor, run the contents of supabase/schema.sql
```

## Local Docker Run

```bash
cp .env.example .env
docker compose up --build
# open http://localhost:3000
```

## Cloud Deployment (AWS Free Tier)

1. **One-time**: bootstrap the Terraform remote state backend
   ```bash
   ./scripts/jenkins/bootstrap-tf-backend.sh
   ```
2. **Provision infrastructure** for an environment:
   ```bash
   cd terraform/environments/dev
   cp terraform.tfvars.example terraform.tfvars   # fill in your key pair name, AMI ID
   terraform init
   terraform plan
   terraform apply
   ```
3. **Update the Ansible inventory** with the Elastic IP from `terraform output app_server_public_ip`.
4. **Provision the host, install k3s, and deploy**:
   ```bash
   ansible-playbook -i ansible/inventories/dev/hosts.yml ansible/playbooks/provision.yml
   ansible-playbook -i ansible/inventories/dev/hosts.yml ansible/playbooks/k8s_provision.yml
   ansible-playbook -i ansible/inventories/dev/hosts.yml ansible/playbooks/k8s_deploy.yml \
     --extra-vars "image_tag=latest docker_image=yourdockerhubuser/bloodconnect deploy_env=dev"
   ```
5. Or trigger the whole flow through **Jenkins**, using the `Jenkinsfile` with the `DEPLOY_ENV` parameter.

### Rollback
Re-run the Jenkins job with `ROLLBACK_TAG` set to any previous build number — the pipeline skips
the build/push/quality-gate stages and redeploys that existing image tag via `k8s_deploy.yml`.
Kubernetes-native rollback also works directly if you'd rather not know the old tag number:
```bash
k3s kubectl rollout undo deployment/bloodconnect-app --namespace=bloodconnect-dev
```

## Kubernetes (k3s)

The app runs on **k3s** — a lightweight, CNCF-conformant Kubernetes distribution — installed
by Ansible on the same EC2 instance Terraform provisions. Real Kubernetes API, real `kubectl`,
real manifests; just without AWS EKS's ~$0.10/hr (~$73/month) control-plane cost, which isn't
covered by Free Tier. Swapping to EKS later is a matter of pointing `kubectl` at a different
cluster — none of the `k8s/` manifests change.

```
k8s/
├── base/
│   ├── deployment.yaml    # 2 replicas, resource limits, liveness/readiness probes on /api/health
│   ├── service.yaml       # NodePort 30080 — fixed so Jenkins/ZAP always know where to look
│   ├── configmap.yaml     # public env vars (Supabase URL)
│   ├── hpa.yaml           # CPU-based autoscaling, 2–5 replicas at 70% utilization
│   └── secret.yaml.example  # template only — real secret is created by Ansible, never committed
└── overlays/
    ├── dev/       # namespace bloodconnect-dev, 1 replica
    ├── staging/   # namespace bloodconnect-staging, 2 replicas
    └── prod/      # namespace bloodconnect-prod, 3 replicas
```

Each environment is a separate Kubernetes **namespace** on the same k3s node, driven by a
[Kustomize](https://kustomize.io) overlay — same base manifests, different replica counts and
namespace per environment. `ansible/playbooks/k8s_deploy.yml` applies the right overlay, creates
the Supabase secret from Ansible's vault-able `group_vars`, sets the actual image tag built by
that Jenkins run, and waits for a healthy rollout before Jenkins moves on.

**Why k3s over plain Docker-on-EC2** (the original deploy path, kept as `ansible/playbooks/deploy.yml`
for reference): self-healing (a crashed pod is automatically restarted), horizontal autoscaling
under load via the HPA, and per-environment replica counts — none of which a single `docker run`
container gives you.

The Kubernetes API server (port 6443) is **not** exposed to the internet — Ansible manages the
cluster by running `k3s kubectl` over SSH on the host itself, so there's no public attack surface
on the control plane at all.

To inspect the cluster directly:
```bash
ssh -i ~/.ssh/bloodconnect-dev-key.pem ubuntu@<ec2-ip>
sudo k3s kubectl get pods -n bloodconnect-dev
sudo k3s kubectl get hpa -n bloodconnect-dev
sudo k3s kubectl logs -n bloodconnect-dev deployment/bloodconnect-app
```

## Observability, Code Quality & Security Scanning

Run the full local stack — app + Prometheus + Grafana + SonarQube — with one command:

```bash
cp .env.example .env
docker compose up --build
```

| Tool | URL | Notes |
|---|---|---|
| App | http://localhost:3000 | |
| Prometheus | http://localhost:9090 | Query `bloodconnect_http_requests_total`, `bloodconnect_blood_requests_created_total`, etc. |
| Grafana | http://localhost:3001 | Login `admin` / `admin` (change on first login). Dashboard "BloodConnect — App & Infra Overview" is pre-loaded. |
| SonarQube | http://localhost:9000 | Login `admin` / `admin` (change on first login). Generate a token under **My Account → Security** for Jenkins to use. |

**Metrics endpoint**: `/api/metrics` exposes Prometheus-format metrics — default Node.js
process metrics (CPU, memory, event loop lag) plus two custom app metrics: HTTP request
rate/duration by route, and blood requests created by urgency and blood group. This last
one is what makes the Grafana dashboard show something domain-specific rather than only
generic infra graphs.

**Local SonarQube scan** (without Jenkins):
```bash
npm install -g sonarqube-scanner   # or use the sonar-scanner CLI directly
sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.login=<your-token>
```

**Local OWASP ZAP scan** (against a running instance, e.g. `http://localhost:3000`):
```bash
docker run --rm -v $(pwd)/security/zap:/zap/wrk:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://host.docker.internal:3000 \
  -c /zap/wrk/zap-rules.tsv \
  -r zap-report.html
```
Open `security/zap/zap-report.html` afterward to see the findings.

In Jenkins, both of these run automatically as pipeline stages — SonarQube's quality gate
can abort the pipeline on failure, and ZAP's report is archived and published as a build
artifact you can open from the Jenkins job page.



```
name,latitude,longitude,address,contact_number,A+,A-,B+,B-,AB+,AB-,O+,O-
City Blood Bank,19.0760,72.8777,Mumbai,022-12345678,10,4,8,2,3,1,15,2
```

## Emergency Numbers (Pre-populated)

| Service              | Number         |
|-----------------------|----------------|
| National Emergency    | 112            |
| Ambulance              | 108            |
| Blood Bank Helpline    | 104            |
| Red Cross India        | 1800-180-1104  |

## License

MIT
