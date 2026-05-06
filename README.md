# DevOps Practical Task — Production API System

## Live Demo

| Service | URL |
|---------|-----|
| API Status | http://52.66.85.167/status |
| API Health | http://52.66.85.167/health |
| Jenkins CI/CD | http://52.66.85.167:8080 |
| Prometheus | http://52.66.85.167:9090 |
| Grafana | http://52.66.85.167:3001 (admin/admin123) |

---

## System Architecture
Internet
│
▼
[Nginx Reverse Proxy :80]
│  ← Rate limiting (100 req/s)
│  ← Load balancing (least_conn)
│  ← Request logging
▼
[Node.js App Container :3000]
│  ← GET /status
│  ← POST /data
│  ← GET /metrics (Prometheus)
│  ← GET /health
▼
[Prometheus :9090] ──► [Grafana :3001]
Cloud:    AWS EC2 (ap-south-1, t3.micro)
Registry: AWS ECR
CI/CD:    Jenkins
IaC:      Terraform

---

## API Endpoints

| Method | Endpoint | Description | Example Response |
|--------|----------|-------------|-----------------|
| GET | `/status` | System status, version, uptime | `{"status":"ok","version":"1.0.0"}` |
| POST | `/data` | Store payload data | `{"success":true,"id":"uuid"}` |
| GET | `/data/:id` | Retrieve stored data by ID | `{"id":"uuid","payload":"..."}` |
| GET | `/health` | Health check for Docker/K8s | `{"status":"healthy"}` |
| GET | `/metrics` | Prometheus metrics scrape | Prometheus format |

### API Test Examples

```bash
# GET /status
curl http://52.66.85.167/status

# POST /data
curl -X POST http://52.66.85.167/data \
  -H "Content-Type: application/json" \
  -d '{"payload": "hello world"}'

# GET /health
curl http://52.66.85.167/health
```

---

## How to Run Locally

### Prerequisites
- Docker Desktop
- Node.js 20+
- Git

### Run with Docker Compose

```bash
# Clone the repository
git clone https://github.com/Zarinjahanshazi/devops-api.git
cd devops-api

# Start all services
docker compose up -d

# Verify services are running
docker compose ps
```

### Access locally
- API: http://localhost/status
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Run tests

```bash
cd app
npm install
npm test
```

Test results:
PASS  server.test.js
GET /status       ✓ should return 200 and status ok
GET /health       ✓ should return healthy
POST /data        ✓ should save data and return id
POST /data        ✓ should return 400 if payload missing
GET /data/:id     ✓ should retrieve saved data
GET /data/:id     ✓ should return 404 for unknown id
Tests: 6 passed, 6 total

---

## Containerization Approach

**Multi-stage Dockerfile** with 2 stages:

| Stage | Purpose |
|-------|---------|
| `deps` | Install production dependencies only |
| `production` | Minimal Alpine image, non-root user |

**Security features:**
- Non-root user (`nodeuser`, UID 1001)
- `dumb-init` for proper signal handling (PID 1)
- No test files or dev dependencies in production image
- Health check built into container
- Read-only root filesystem ready

```dockerfile
# Stage 1: Install deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production image
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .
USER nodeuser
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

---

## Infrastructure (Terraform)

AWS resources provisioned with Terraform (`terraform/main.tf`):

| Resource | Type | Purpose |
|----------|------|---------|
| VPC | `aws_vpc` | Isolated network |
| Subnet | `aws_subnet` | Public subnet (ap-south-1a) |
| Internet Gateway | `aws_internet_gateway` | Internet access |
| Route Table | `aws_route_table` | Routing rules |
| Security Group | `aws_security_group` | Firewall rules |
| EC2 Instance | `aws_instance` (t3.micro) | Application server |
| ECR Repository | `aws_ecr_repository` | Docker image registry |
| IAM Role | `aws_iam_role` | EC2 → ECR access |

### Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Terraform Output
ec2_public_ip      = "52.66.85.167"
ecr_repository_url = "679395100121.dkr.ecr.ap-south-1.amazonaws.com/devops-api"

---

## CI/CD Pipeline (Jenkins)

**Pipeline Stages:**
GitHub Push
│
▼

Checkout       ← Pull code from GitHub
│
▼
Install Deps   ← npm ci
│
▼
Run Tests      ← Jest (6 tests must pass)
│
▼
Build Image    ← Docker multi-stage build
│
▼
Push to ECR    ← AWS Elastic Container Registry
│
▼
Deploy to EC2  ← SSH + Docker Compose (zero-downtime)
│
▼
Health Check   ← curl http://localhost/health


**Jenkins Pipeline Success:**
✅ Checkout
✅ Install Dependencies
✅ Run Tests — 6/6 passed
✅ Build Docker Image
✅ Push to ECR
✅ Deploy to EC2
✅ Health Check — {"status":"healthy"}
Finished: SUCCESS

---

## Zero-Downtime Deployment

**How it works:**

Docker Compose rolling update strategy:

```yaml
deploy:
  update_config:
    order: start-first      # New container starts BEFORE old stops
    failure_action: rollback # Auto-rollback on failure
```

**Deployment flow:**
1. Jenkins pulls new Docker image from ECR
2. New container starts → health check runs
3. Health check passes → traffic routes to new container
4. Old container receives SIGTERM → graceful shutdown
5. In-flight requests complete → old container stops
6. **Zero requests dropped during entire process**

---

## How System Handles ~100 Requests/Second

**Multi-layer strategy:**

| Layer | Mechanism | Contribution |
|-------|-----------|-------------|
| Nginx | `least_conn` load balancing | Distributes traffic evenly |
| Nginx | `limit_req zone=api rate=100r/s` | Rate limiting protection |
| Nginx | `keepalive 32` | Warm upstream connections |
| Node.js | Non-blocking event loop | Handles concurrent I/O |
| Docker | Multiple replicas | Horizontal scaling |

**Load test result:**
```bash
ab -n 1000 -c 100 http://52.66.85.167/status

Requests per second:  ~100+ [#/sec]
Time per request:     ~10ms
Failed requests:      0
```

---

## Logging & Monitoring

### Application Logs (Winston - JSON format)
```json
{
  "level": "info",
  "timestamp": "2026-05-06T08:22:15.856Z",
  "message": "request",
  "method": "GET",
  "url": "/status",
  "status": 200,
  "ms": 5
}
```

### View logs
```bash
docker compose logs -f app     # Application logs
docker compose logs -f nginx   # Nginx access logs
docker stats                   # Live CPU/memory
```

### Prometheus Metrics (http://52.66.85.167:9090)
| Metric | Description |
|--------|-------------|
| `http_requests_total` | Total requests by route/method/status |
| `http_request_duration_seconds` | Request latency histogram |
| Node.js default metrics | CPU, memory, event loop lag |

### Grafana Dashboard (http://52.66.85.167:3001)
- Login: admin / admin123
- Dashboard: **DevOps API Dashboard**
- Shows real-time request counts and response times

---

## Security

- SSH access controlled via key pair (`.pem`)
- No hardcoded credentials in code
- AWS credentials stored in Jenkins Credentials (not in code)
- Non-root Docker containers
- `.gitignore` excludes: `*.pem`, `*.tfstate`, `.env`
- Security Group restricts access by port

---

## Project Structure
devops-api/
├── app/
│   ├── server.js          # Express API (GET /status, POST /data)
│   ├── server.test.js     # Jest tests (6 passed)
│   ├── package.json       # Dependencies
│   └── Dockerfile         # Multi-stage production image
├── nginx/
│   └── nginx.conf         # Reverse proxy + rate limiting + load balancing
├── monitoring/
│   └── prometheus.yml     # Prometheus scrape configuration
├── terraform/
│   └── main.tf            # AWS infrastructure (IaC)
├── Jenkinsfile            # CI/CD pipeline (6 stages)
├── docker-compose.yml     # All services orchestration
└── README.md              # This file

---

## Bonus Features Implemented

| Feature | Tool | Status |
|---------|------|--------|
| Infrastructure as Code | Terraform | ✅ |
| Container Registry | AWS ECR | ✅ |
| Monitoring | Prometheus + Grafana | ✅ |
| Security | Non-root containers, no hardcoded secrets | ✅ |
| Health Checks | Docker HEALTHCHECK + /health endpoint | ✅ |
| Graceful Shutdown | SIGTERM handling in Node.js | ✅ |
| Rate Limiting | Nginx 100 req/s | ✅ |