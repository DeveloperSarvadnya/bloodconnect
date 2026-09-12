pipeline {
    agent any

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['dev', 'staging', 'prod'], description: 'Target environment')
        string(name: 'ROLLBACK_TAG', defaultValue: '', description: 'If set, redeploy this existing image tag instead of building a new one')
        booleanParam(name: 'SKIP_ZAP', defaultValue: false, description: 'Skip the OWASP ZAP scan (useful for quick iteration)')
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        DOCKER_IMAGE          = "yourdockerhubuser/bloodconnect"
        IMAGE_TAG             = "${env.BUILD_NUMBER}"
        AWS_CREDENTIALS       = credentials('aws-creds')
        SUPABASE_URL          = credentials('supabase-url')
        SUPABASE_ANON_KEY     = credentials('supabase-anon-key')
        SONAR_TOKEN           = credentials('sonar-token')
        SONAR_HOST_URL        = "http://sonarqube:9000"
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
            steps {
                dir("terraform/environments/${params.DEPLOY_ENV}") {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-creds']]) {
                        sh '''
                            terraform init -input=false
                            terraform validate
                            terraform plan -out=tfplan -input=false
                            terraform apply -input=false tfplan
                        '''
                    }
                }
            }
        }

        stage('Ansible: Provision Host + k3s') {
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
            steps {
                script {
                    def deployTag = params.ROLLBACK_TAG?.trim() ? params.ROLLBACK_TAG : env.IMAGE_TAG
                    sh """
                        ansible-playbook -i ansible/inventories/${params.DEPLOY_ENV}/hosts.yml \
                            ansible/playbooks/k8s_deploy.yml \
                            --extra-vars "image_tag=${deployTag} docker_image=${env.DOCKER_IMAGE} deploy_env=${params.DEPLOY_ENV}"
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    env.TARGET_HOST = sh(
                        script: "ansible-inventory -i ansible/inventories/${params.DEPLOY_ENV}/hosts.yml --list | python3 -c \"import json,sys; d=json.load(sys.stdin); print(d['app_servers']['hosts'][0])\"",
                        returnStdout: true
                    ).trim()

                    // k8s_deploy.yml already waits for a healthy rollout on the host
                    // itself; this is the same check from Jenkins' perspective, over
                    // the NodePort the Service exposes (k8s/base/service.yaml).
                    retry(5) {
                        sleep(time: 10, unit: 'SECONDS')
                        sh "curl -f http://${env.TARGET_HOST}:30080/api/health"
                    }
                }
            }
        }

        stage('Security Scan (OWASP ZAP)') {
            when { expression { !params.SKIP_ZAP } }
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
            echo "Deployment to ${params.DEPLOY_ENV} succeeded — image tag: ${params.ROLLBACK_TAG ?: env.IMAGE_TAG}"
            echo "SonarQube report: ${SONAR_HOST_URL}/dashboard?id=bloodconnect"
        }
        failure {
            echo "Pipeline failed. To roll back, re-run this job with ROLLBACK_TAG set to a previously known-good build number."
        }
        always {
            sh 'docker logout || true'
        }
    }
}
