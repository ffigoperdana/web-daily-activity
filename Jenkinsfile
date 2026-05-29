    pipeline {
        agent any

        environment {
            // Coolify API (via coolify Docker network, internal port 80)
            COOLIFY_API_URL    = 'http://coolify:8080/api/v1'
            COOLIFY_TOKEN      = credentials('coolify-api-token')
            COOLIFY_APP_UUID   = credentials('coolify-app-uuid')

            // Cloudflare Workers (for Push_Service deploy)
            CLOUDFLARE_API_TOKEN = credentials('cloudflare-api-token')
        }

        tools {
            nodejs 'node-20'
        }

        stages {
            stage('Checkout') {
                steps {
                    checkout scm
                }
            }

            stage('Install') {
                steps {
                    sh 'corepack enable && corepack prepare pnpm@9 --activate'
                    sh 'pnpm install --frozen-lockfile || pnpm install'
                }
            }

            stage('Lint') {
                steps {
                    sh 'pnpm lint'
                }
            }

            stage('Test') {
                parallel {
                    stage('Unit Tests - Tracker') {
                        steps {
                            sh 'pnpm --filter tracker run test:unit'
                        }
                    }
                    stage('Unit Tests - Push Service') {
                        steps {
                            sh 'pnpm --filter push-service run test'
                        }
                    }
                }
            }

            stage('Deploy') {
                parallel {
                    stage('Deploy Tracker (Coolify)') {
                        steps {
                            script {
                                // Trigger Coolify to redeploy the application.
                                // Coolify pulls from GitHub and builds using the Dockerfile.
                                // The .env file must exist in the repo (or configured in Coolify
                                // as "Build Environment Variables" which get written to .env).
                                sh """
                                    curl -sf -X POST \
                                        "${COOLIFY_API_URL}/deploy" \
                                        -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
                                        -H "Content-Type: application/json" \
                                        -d '{"uuid": "${COOLIFY_APP_UUID}", "force_rebuild": true}'
                                """
                            }
                        }
                    }
                    stage('Deploy Push Service (Cloudflare Workers)') {
                        when {
                            changeset 'push-service/**'
                        }
                        steps {
                            dir('push-service') {
                                sh """
                                    CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN} \
                                    npx wrangler deploy
                                """
                            }
                        }
                    }
                }
            }
        }

        post {
            success {
                echo '✅ Pipeline completed successfully!'
            }
            failure {
                echo '❌ Pipeline failed.'
            }
            always {
                cleanWs()
            }
        }
    }
