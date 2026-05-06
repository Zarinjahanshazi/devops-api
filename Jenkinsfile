pipeline {
    agent any

    environment {
        APP_NAME    = 'devops-api'
        AWS_REGION  = 'ap-south-1'
        ECR_REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
        ECR_REPO    = "${ECR_REGISTRY}/${APP_NAME}"
        EC2_USER    = 'ubuntu'
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }
                echo "Building image tag: ${env.IMAGE_TAG}"
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('app') {
                    sh 'npm ci'
                }
            }
        }

        stage('Run Tests') {
            steps {
                dir('app') {
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('app') {
                    sh """
                        docker build \
                          --target production \
                          -t ${APP_NAME}:${env.IMAGE_TAG} \
                          -t ${APP_NAME}:latest \
                          .
                    """
                }
            }
        }

        stage('Push to ECR') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-credentials'
                ]]) {
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | \
                          docker login --username AWS --password-stdin ${ECR_REGISTRY}

                        docker tag ${APP_NAME}:${env.IMAGE_TAG} ${ECR_REPO}:${env.IMAGE_TAG}
                        docker tag ${APP_NAME}:${env.IMAGE_TAG} ${ECR_REPO}:latest

                        docker push ${ECR_REPO}:${env.IMAGE_TAG}
                        docker push ${ECR_REPO}:latest
                    """
                }
            }
        }

        stage('Deploy to EC2') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'ec2-ssh-key',
                        keyFileVariable: 'SSH_KEY'
                    ),
                    string(
                        credentialsId: 'ec2-host',
                        variable: 'EC2_HOST'
                    ),
                    [
                        $class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: 'aws-credentials'
                    ]
                ]) {
                    sh """
                        # Create directories on EC2
                        ssh -i \$SSH_KEY \
                          -o StrictHostKeyChecking=no \
                          ${EC2_USER}@\${EC2_HOST} \
                          "mkdir -p /home/ubuntu/app/nginx /home/ubuntu/app/monitoring"

                        # Copy files to EC2
                        scp -i \$SSH_KEY \
                          -o StrictHostKeyChecking=no \
                          docker-compose.yml \
                          ${EC2_USER}@\${EC2_HOST}:/home/ubuntu/app/

                        scp -i \$SSH_KEY \
                          -o StrictHostKeyChecking=no -r \
                          nginx/ monitoring/ \
                          ${EC2_USER}@\${EC2_HOST}:/home/ubuntu/app/

                        # Deploy on EC2
                        ssh -i \$SSH_KEY \
                          -o StrictHostKeyChecking=no \
                          ${EC2_USER}@\${EC2_HOST} bash << 'REMOTE'
                            set -e
                            cd /home/ubuntu/app

                            aws ecr get-login-password --region ${AWS_REGION} | \
                              docker login --username AWS \
                              --password-stdin ${ECR_REGISTRY}

                            export APP_VERSION=${env.IMAGE_TAG}
                            export NODE_ENV=production

                            docker compose pull
                            docker compose up -d
                            sleep 15
                            curl -sf http://localhost/health || exit 1
                            echo "Deploy successful!"
REMOTE
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded! Image: ${ECR_REPO}:${env.IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed! Check logs above."
        }
        always {
            sh "docker rmi ${APP_NAME}:latest || true"
            sh "docker system prune -f || true"
        }
    }
}