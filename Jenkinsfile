pipeline {
    agent any

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['dev', 'staging', 'prod'], description: 'Target environment')
        string(name: 'ROLLBACK_TAG', defaultValue: '', description: 'If set, redeploy this existing image tag instead of building a new one')
        booleanParam(name: 'SKIP_ZAP', defaultValue: false, description: 'Skip the OWASP ZAP scan (useful for quick iteration)')
        booleanParam(name: 'CI_ONLY', defaultValue: true, description: 'Run only CI/Quality check stages without provisioning AWS infrastructure')
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        DOCKER_IMAGE          = "2sarvadnya2/bloodconnect"
        IMAGE_TAG             = "${env.BUILD_NUMBER}"
        AWS_CREDENTIALS       = credentials('aws-creds')
        SUPABASE_URL          = credentials('supabase-url')
        SUPABASE_ANON_KEY     = credentials('supabase-anon-key')
        SONAR_TOKEN           = credentials('sonar-token')
        SONAR_HOST_URL        = "http://sonarqube:9000"
        SONAR_PUBLIC_URL      = "http://localhost:9000"
        SLACK_CHANNEL         = "#bloodconnect-builds"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Lint') {
            when { expression { params.ROLLBACK_TAG == '' } }
            steps {
                sh '''
                    npm ci
                    npm run lint
                '''
            }
        }

        stage('Build (CI check)') {
            when { expression { params.ROLLBACK_TAG == '' } }
            steps {
                sh '''
                    NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
                    NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
                    npm run build
                '''
            }
        }

        stage('Code Quality (SonarQube)') {
            when { expression { params.ROLLBACK_TAG == '' } }
            steps {
                script {
                    def scannerHome = tool 'sonar-scanner'  // configured under Manage Jenkins -> Tools
                    withSonarQubeEnv('sonarqube-server') {  // configured under Manage Jenkins -> System
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.host.url=${SONAR_HOST_URL} \
                              -Dsonar.login=${SONAR_TOKEN}
                        """
                    }
                }
            }
        }

        stage('Quality Gate') {
            when { expression { params.ROLLBACK_TAG == '' } }
            steps {
                // Waits for SonarQube's background analysis to post a pass/fail verdict.
                // Fails the whole pipeline if the project fails its quality gate —
                // this is what makes SonarQube a real gate, not just a report.
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker Build & Push') {
            when { expression { params.ROLLBACK_TAG == '' } }
            steps {
                sh '''
                    echo "$DOCKERHUB_CREDENTIALS_PSW" | docker login -u "$DOCKERHUB_CREDENTIALS_USR" --password-stdin

                    docker build \
                        --build-arg NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
                        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
                        -t $DOCKER_IMAGE:$IMAGE_TAG \
                        -t $DOCKER_IMAGE:latest .

                    docker push $DOCKER_IMAGE:$IMAGE_TAG
                    docker push $DOCKER_IMAGE:latest
                '''
            }
        }

        stage('Terraform Plan/Apply') {
            when { expression { !params.CI_ONLY } }
            steps {
                dir("terraform/environments/${params.DEPLOY_ENV}") {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-creds']]) {
                        sh '''
                            terraform init -input=false
                            terraform validate
                            terraform plan -out=tfplan -input=false
                            terraform apply -input=false tfplan
                            APP_IP=$(terraform output -raw app_server_public_ip)
                            echo "Provisioned App Server Elastic IP: ${APP_IP}"
                            sed -i "s/ansible_host:.*/ansible_host: ${APP_IP}/" ../../../ansible/inventories/${params.DEPLOY_ENV}/hosts.yml
                        '''
                    }
                }
            }
        }

        stage('Ansible: Provision Host + k3s') {
            when { expression { !params.CI_ONLY } }
            steps {
                sh """
                    ansible-playbook -i ansible/inventories/${params.DEPLOY_ENV}/hosts.yml \
                        ansible/playbooks/provision.yml

                    ansible-playbook -i ansible/inventories/${params.DEPLOY_ENV}/hosts.yml \
                        ansible/playbooks/k8s_provision.yml
                """
            }
        }

        stage('Ansible: Deploy to Kubernetes') {
            when { expression { !params.CI_ONLY } }
            steps {
                script {
                    def deployTag = params.ROLLBACK_TAG?.trim() ? params.ROLLBACK_TAG : env.IMAGE_TAG
                    sh """
                        ansible-playbook -i ansible/inventories/${params.DEPLOY_ENV}/hosts.yml \
                            ansible/playbooks/k8s_deploy.yml \
                            --extra-vars "image_tag=${deployTag} docker_image=${env.DOCKER_IMAGE} deploy_env=${params.DEPLOY_ENV} supabase_anon_key=${SUPABASE_ANON_KEY}"
                    """
                }
            }
        }

        stage('Health Check') {
            when { expression { !params.CI_ONLY } }
            steps {
                script {
                    env.TARGET_HOST = sh(
                        script: "ansible-inventory -i ansible/inventories/${params.DEPLOY_ENV}/hosts.yml --list | python3 -c \"import json,sys; d=json.load(sys.stdin); host=d['app_servers']['hosts'][0]; print(d['_meta']['hostvars'][host].get('ansible_host', host))\"",
                        returnStdout: true
                    ).trim()

                    echo "Target Host IP: ${env.TARGET_HOST}"

                    // k8s_deploy.yml already waits for a healthy rollout on the host
                    // itself; this is the same check from Jenkins' perspective, over
                    // the NodePort the Service exposes (k8s/base/service.yaml).
                    retry(8) {
                        sleep(time: 10, unit: 'SECONDS')
                        sh "curl -f http://${env.TARGET_HOST}:30080/api/health"
                    }
                }
            }
        }

        stage('Security Scan (OWASP ZAP)') {
            when { expression { !params.SKIP_ZAP && !params.CI_ONLY } }
            steps {
                // Runs ZAP's baseline scan (passive, non-destructive) against the
                // freshly deployed instance. Uses the official zaproxy Docker image
                // so no local ZAP install is needed on the Jenkins agent.
                sh """
                    mkdir -p zap-report
                    docker run --rm \
                        -v \$(pwd)/zap-report:/zap/wrk:rw \
                        -v \$(pwd)/security/zap/zap-rules.tsv:/zap/rules.tsv:ro \
                        ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
                        -t http://${env.TARGET_HOST}:30080 \
                        -c rules.tsv \
                        -r zap-report.html \
                        -J zap-report.json \
                        || true
                """
                // zap-baseline.py exits non-zero on WARN/FAIL findings by design —
                // "|| true" keeps the pipeline from hard-failing on warnings while
                // we still archive the report for review below.
                archiveArtifacts artifacts: 'zap-report/*.html,zap-report/*.json', allowEmptyArchive: true
                publishHTML(target: [
                    reportDir: 'zap-report',
                    reportFiles: 'zap-report.html',
                    reportName: 'OWASP ZAP Report',
                    keepAll: true,
                    alwaysLinkToLastBuild: true
                ])
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded — image tag: ${params.ROLLBACK_TAG ?: env.IMAGE_TAG}"
            echo "SonarQube report: ${SONAR_PUBLIC_URL}/dashboard?id=bloodconnect"
            withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK_URL')]) {
                sh '''
                    python3 -c "
import os, urllib.request, json
mode = 'CI & Security Gate (Local)' if os.environ.get('CI_ONLY') == 'true' else f'Deployment to {os.environ.get(\\"DEPLOY_ENV\\")} (AWS)'
tag = os.environ.get('ROLLBACK_TAG') or os.environ.get('IMAGE_TAG')
target_host = os.environ.get('TARGET_HOST')
app_url = f'\\nLive App: http://{target_host}:30080' if target_host else ''
text = f'✅ *BloodConnect* build #{os.environ.get(\\"BUILD_NUMBER\\")} *succeeded* [{mode}]\\nImage: {os.environ.get(\\"DOCKER_IMAGE\\")}:{tag}{app_url}\\nSonarQube: {os.environ.get(\\"SONAR_PUBLIC_URL\\")}/dashboard?id=bloodconnect\\n<{os.environ.get(\\"BUILD_URL\\")}|View Build>'
payload = json.dumps({'channel': os.environ.get('SLACK_CHANNEL'), 'text': text}).encode('utf-8')
req = urllib.request.Request(os.environ.get('SLACK_WEBHOOK_URL'), data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'Jenkins'})
try:
    urllib.request.urlopen(req)
except Exception as e:
    print('Slack notification error:', e)
" || true
                '''
            }
        }
        failure {
            echo "Pipeline failed. To roll back, re-run this job with ROLLBACK_TAG set to a previously known-good build number."
            withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK_URL')]) {
                sh '''
                    python3 -c "
import os, urllib.request, json
text = f'❌ *BloodConnect* build #{os.environ.get(\\"BUILD_NUMBER\\")} *failed*\\nEnv: {os.environ.get(\\"DEPLOY_ENV\\")}\\n<{os.environ.get(\\"BUILD_URL\\")}console|View Console Output>'
payload = json.dumps({'channel': os.environ.get('SLACK_CHANNEL'), 'text': text}).encode('utf-8')
req = urllib.request.Request(os.environ.get('SLACK_WEBHOOK_URL'), data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'Jenkins'})
try:
    urllib.request.urlopen(req)
except Exception as e:
    print('Slack notification error:', e)
" || true
                '''
            }
        }
        always {
            sh 'docker logout || true'
        }
    }
}
