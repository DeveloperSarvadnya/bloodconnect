# BloodConnect — Environment Setup Guide

Use your **Mac** as the main machine for this project. Everything below assumes macOS.
(If a teammate is on Windows, see the note at the very bottom.)

---

## 1. Install core tools

Open Terminal and install [Homebrew](https://brew.sh) first if you don't have it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install everything else:

```bash
brew install node          # JavaScript runtime (app dev)
brew install git            # version control
brew install --cask docker  # Docker Desktop (includes Docker + Compose)
brew install terraform      # infrastructure as code
brew install ansible        # provisioning/deployment automation
brew install kubectl        # talks to the k3s cluster once it's deployed
brew install awscli         # AWS command-line tool
```

After installing, **open Docker Desktop once** from Applications and let it fully start
(you'll see a whale icon in the menu bar go steady). Docker commands won't work until
Docker Desktop is running.

Verify everything installed correctly:

```bash
node -v
docker --version
terraform -version
ansible --version
aws --version
```

Each should print a version number, not "command not found."

---

## 2. Set up accounts (do these once)

1. **Supabase** — [supabase.com](https://supabase.com) → New Project (free tier). Note down:
   - Project URL
   - `anon` public API key
   (Settings → API in the Supabase dashboard)

2. **AWS** — you already have Free Tier. In the AWS Console:
   - Go to **IAM** → create a user for yourself with **AdministratorAccess** (fine for a class project) → generate an **Access Key ID + Secret Access Key**
   - Go to **EC2 → Key Pairs** → create a key pair named `bloodconnect-dev-key`, download the `.pem` file
   - Note your region (use `ap-south-1` — Mumbai — for lowest latency from India)

3. **Docker Hub** — [hub.docker.com](https://hub.docker.com) → free account, this is where Jenkins will push built images.

4. **GitHub** — push this project to a repo (`git init`, `git add .`, `git commit`, create repo on GitHub, `git push`).

---

## 3. Configure AWS CLI locally

```bash
aws configure
```
Enter your Access Key ID, Secret Access Key, region (`ap-south-1`), and output format (`json`).

Move your downloaded `.pem` key somewhere permanent and lock down its permissions:

```bash
mkdir -p ~/.ssh
mv ~/Downloads/bloodconnect-dev-key.pem ~/.ssh/
chmod 400 ~/.ssh/bloodconnect-dev-key.pem
```

---

## 4. Run the app locally (no cloud yet)

```bash
cd bloodconnect
npm install
cp .env.example .env.local
```

Open `.env.local` and paste in your Supabase URL + anon key.

Apply the database schema: open your Supabase project → **SQL Editor** → paste the entire
contents of `supabase/schema.sql` → Run.

Then:

```bash
npm run dev
```

Visit `http://localhost:3000` — you should see the BloodConnect landing page.

---

## 5. Run it in Docker locally

```bash
cp .env.example .env
docker compose up --build
```

Visit `http://localhost:3000` again — same app, now running inside a container.
Stop with `Ctrl+C`, or `docker compose down`.

---

## 5b. Run the full observability + quality stack

The same `docker compose up --build` command also starts Prometheus, Grafana, and
SonarQube alongside the app — they're all defined in `docker-compose.yml`.

Once it's up:
- **App**: http://localhost:3000
- **Prometheus**: http://localhost:9090 — try the query `bloodconnect_http_requests_total`
- **Grafana**: http://localhost:3001 — login `admin`/`admin`, dashboard is pre-loaded
- **SonarQube**: http://localhost:9000 — login `admin`/`admin`

Generate a few blood requests through the app UI, then check Grafana — the "Blood
Requests Created" panels should start showing data within ~15 seconds (Prometheus's
scrape interval).


## 6. Provision AWS infrastructure with Terraform

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
- `key_pair_name` → `bloodconnect-dev-key` (the one you created in step 2)
- `ami_id` → verify the current Ubuntu 22.04 LTS AMI ID for `ap-south-1` in the AWS Console (EC2 → Launch Instance → search "Ubuntu 22.04" → copy the AMI ID shown), since AMI IDs change over time

Before this works, run the **one-time state backend bootstrap** (creates an S3 bucket + DynamoDB table Terraform uses to store its state safely):

```bash
cd ../../..
./scripts/jenkins/bootstrap-tf-backend.sh
```

Then:

```bash
cd terraform/environments/dev
terraform init
terraform plan     # shows what will be created — review it
terraform apply    # type "yes" when prompted
```

When it finishes, note the output IP:
```bash
terraform output app_server_public_ip
```

---

## 7. Deploy with Ansible

Update `ansible/inventories/dev/hosts.yml` — replace `REPLACE_WITH_TERRAFORM_OUTPUT_IP`
with the IP from the last step, and update the key path if needed.

Copy the secrets template and fill it in:
```bash
cd ../../../ansible
cp group_vars/all.yml.example group_vars/all.yml
```
Edit `group_vars/all.yml` with your real Docker Hub username/token and Supabase URL/key.

Provision the server (installs Docker, sets up firewall):
```bash
ansible-playbook -i inventories/dev/hosts.yml playbooks/provision.yml
```

Install k3s (lightweight Kubernetes) on the same server:
```bash
ansible-playbook -i inventories/dev/hosts.yml playbooks/k8s_provision.yml
```
This takes a couple of minutes the first time — it's downloading and starting k3s.

Build and push your image manually the first time (Jenkins will automate this later):
```bash
cd ..
docker build -t yourdockerhubuser/bloodconnect:latest \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=<your-url> \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key> .
docker login
docker push yourdockerhubuser/bloodconnect:latest
```

Deploy it to the k3s cluster on your EC2 instance:
```bash
cd ansible
ansible-playbook -i inventories/dev/hosts.yml playbooks/k8s_deploy.yml \
  --extra-vars "image_tag=latest docker_image=yourdockerhubuser/bloodconnect deploy_env=dev"
```

Visit `http://<your-ec2-ip>:30080` in your browser — the app should be live on AWS, running
as Kubernetes pods rather than a single container.

Check on the cluster directly if you want to see it for yourself:
```bash
ssh -i ~/.ssh/bloodconnect-dev-key.pem ubuntu@<your-ec2-ip>
sudo k3s kubectl get pods -n bloodconnect-dev
sudo k3s kubectl get hpa -n bloodconnect-dev
```

---

## 8. Set up Jenkins (ties it all together)

Easiest path: run Jenkins itself in Docker, locally on your Mac, for development/demo purposes.

```bash
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts
```

Open `http://localhost:8080`, get the initial admin password:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Install suggested plugins, then install these additionally (**Manage Jenkins → Plugins**):
- Docker Pipeline
- Terraform
- Ansible
- AWS Credentials
- Pipeline: AWS Steps
- SonarQube Scanner
- HTML Publisher (needed to display the OWASP ZAP report in Jenkins)

Configure SonarQube integration:
1. Start SonarQube locally: `docker compose up sonarqube` (or it's already running from `docker compose up`)
2. Open `http://localhost:9000`, log in (`admin`/`admin`), change the password
3. Go to **My Account → Security → Generate Token**, name it `jenkins`, copy the token
4. In Jenkins: **Manage Jenkins → System → SonarQube servers** → add one named `sonarqube-server`,
   URL `http://sonarqube:9000` (or `http://host.docker.internal:9000` if Jenkins runs outside the
   same Docker network), and paste the token
5. In Jenkins: **Manage Jenkins → Tools → SonarQube Scanner installations** → add one named `sonar-scanner`, let it auto-install

Add credentials (**Manage Jenkins → Credentials**):
- `dockerhub-creds` — your Docker Hub username/password
- `aws-creds` — your AWS Access Key ID/Secret
- `supabase-url`, `supabase-anon-key` — as Secret text
- `sonar-token` — as Secret text, the token you generated above

Create a new **Pipeline** job → point it at your GitHub repo → it will pick up the
`Jenkinsfile` automatically. Run it with the `DEPLOY_ENV` parameter set to `dev`.

---

## Notes for a Windows teammate

Everything above works on Windows **except Ansible**, which needs a Linux environment:

1. Install **WSL2**: open PowerShell as Administrator, run `wsl --install`, restart.
2. Install **Ubuntu** from the Microsoft Store (this becomes your Linux environment inside Windows).
3. Open the Ubuntu app, then follow this guide's Linux-equivalent commands inside it
   (use `apt install ansible` instead of `brew install ansible`, everything else is the same).
4. Docker Desktop for Windows has a WSL2 integration toggle — enable it in Docker Desktop
   settings so Docker commands work from inside your Ubuntu/WSL terminal too.

Terraform, Node, Docker, and AWS CLI can be installed directly on Windows via their normal
installers if preferred — only Ansible strictly needs WSL.
