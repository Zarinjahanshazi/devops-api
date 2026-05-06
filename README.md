# DevOps Practical Task — Production API System

A production-ready Node.js API with Docker containerization, Nginx reverse proxy, Jenkins CI/CD pipeline, and Infrastructure as Code using Terraform. Deployed on AWS with Prometheus and Grafana monitoring.

---

## 🏗️ System Architecture

```
                          Internet
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Nginx Reverse Proxy │
                  │   (Port 80)         │
                  ├─────────────────────┤
                  │ • Rate limiting     │
                  │ • Load balancing    │
                  │ • Request logging   │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │  Node.js App        │
                  │  (Port 3000)        │
                  ├─────────────────────┤
                  │ • GET /status       │
                  │ • POST /data        │
                  │ • GET /metrics      │
                  │ • GET /health       │
                  └──────────┬──────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
          ┌──────────────┐          ┌──────────────┐
          │ Prometheus   │          │   Grafana    │
          │  (Port 9090) │          │  (Port 3001) │
          └──────────────┘          └──────────────┘

Cloud Platform: AWS EC2 (ap-south-1, t3.micro)
Container Registry: AWS ECR
CI/CD: Jenkins
Infrastructure as Code: Terraform
```

---

## 📋 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Application** | Node.js 20 + Express | REST API |
| **Container** | Docker (Multi-stage) | Containerization |
| **Reverse Proxy** | Nginx | Load balancing, rate limiting |
| **CI/CD** | Jenkins | Automated builds and deployments |
| **IaC** | Terraform | AWS resource management |
| **Monitoring** | Prometheus + Grafana | Metrics collection and visualization |
| **Cloud** | AWS EC2, ECR | Hosting and container registry |

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/status` | System status, version, uptime | `{"status":"ok","version":"1.0.0"}` |
| POST | `/data` | Store payload data | `{"success":true,"id":"uuid"}` |
| GET | `/data/:id` | Retrieve stored data by ID | `{"id":"uuid","payload":"..."}` |
| GET | `/health` | Health check (Docker/K8s) | `{"status":"healthy"}` |
| GET | `/metrics` | Prometheus metrics | Prometheus format |

### Test API Locally

```bash
# Check API status
curl http://localhost/status

# Send data to API
curl -X POST http://localhost/data \
  -H "Content-Type: application/json" \
  -d '{"payload": "hello world"}'

# Health check
curl http://localhost/health

# View Prometheus metrics
curl http://localhost/metrics
```

---

## 🚀 Quick Start

### Prerequisites

- Docker Desktop (includes Docker Compose)
- Node.js 20+ (for local development)
- Git
- AWS account (for deployment)

### Run with Docker Compose

```bash
# Clone repository
git clone https://github.com/Zarinjahanshazi/devops-api.git
cd devops-api

# Start all services
docker compose up -d

# Verify services
docker compose ps
```

### Access Services Locally

| Service | URL |
|---------|-----|
| API | http://localhost/status |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

**Grafana Login:** Default credentials (change after first login)

### Run Tests

```bash
cd app
npm install
npm test
```

**Expected Output:**
```
PASS  server.test.js
  ✓ GET /status should return 200 and status ok
  ✓ GET /health should return healthy
  ✓ POST /data should save data and return id
  ✓ POST /data should return 400 if payload missing
  ✓ GET /data/:id should retrieve saved data
  ✓ GET /data/:id should return 404 for unknown id

Tests: 6 passed, 6 total
```

---

## 🐳 Containerization

### Multi-Stage Dockerfile

The project uses a **2-stage build** for optimal image size and security:

| Stage | Purpose |
|-------|---------|
| `deps` | Install production dependencies only |
| `production` | Minimal Alpine base, non-root user |

### Security Features

✅ Non-root user (`nodeuser`, UID 1001)  
✅ `dumb-init` for proper PID 1 signal handling  
✅ No test files or dev dependencies in production  
✅ Docker HEALTHCHECK configured  
✅ Read-only filesystem ready  

### Dockerfile

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production image
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .

USER nodeuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

---

## 🏛️ Infrastructure as Code (Terraform)

### AWS Resources

| Resource | Type | Purpose |
|----------|------|---------|
| VPC | `aws_vpc` | Isolated network |
| Subnet | `aws_subnet` | Public subnet (ap-south-1a) |
| Internet Gateway | `aws_internet_gateway` | Internet access |
| Route Table | `aws_route_table` | Routing configuration |
| Security Group | `aws_security_group` | Firewall (ports: 22, 80, 8080, 9090, 3001) |
| EC2 Instance | `aws_instance` (t3.micro) | Application server |
| ECR Repository | `aws_ecr_repository` | Docker image registry |
| IAM Role | `aws_iam_role` | EC2 to ECR permissions |

### Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init

# Review planned changes
terraform plan

# Apply infrastructure
terraform apply
```

### Terraform Outputs

```
ec2_public_ip      = <Your-EC2-IP>
ecr_repository_url = <Your-AWS-Account>.dkr.ecr.ap-south-1.amazonaws.com/devops-api
```

---

## 🔄 CI/CD Pipeline (Jenkins)

### Pipeline Architecture

```
GitHub Push
    │
    ▼
┌────────────┐
│  Checkout  │ ← Pull latest code
└──────┬─────┘
       ▼
┌────────────┐
│ Install    │ ← npm ci
│   Deps     │
└──────┬─────┘
       ▼
┌────────────┐
│   Tests    │ ← Jest (6 tests must pass)
└──────┬─────┘
       ▼
┌────────────┐
│   Build    │ ← Docker multi-stage build
│   Image    │
└──────┬─────┘
       ▼
┌────────────┐
│  Push to   │ ← AWS ECR
│    ECR     │
└──────┬─────┘
       ▼
┌────────────┐
│  Deploy    │ ← SSH + Docker Compose
│   to EC2   │   (zero-downtime)
└──────┬─────┘
       ▼
┌────────────┐
│   Health   │ ← curl /health endpoint
│   Check    │
└────────────┘
```

### Successful Build Output

```
✅ Checkout
✅ Install Dependencies
✅ Run Tests — 6/6 passed
✅ Build Docker Image
✅ Push to ECR
✅ Deploy to EC2
✅ Health Check — {"status":"healthy"}

Finished: SUCCESS
```

---

## 🔄 Zero-Downtime Deployment

The deployment process ensures **zero dropped requests** during updates:

### Deployment Flow

1. **Jenkins pulls** new Docker image from ECR
2. **New container starts** → Docker health check runs
3. **Health check passes** → Nginx routes traffic to new container
4. **Old container** receives `SIGTERM` signal
5. **Graceful shutdown** → In-flight requests complete
6. **Old container stops** → Deployment complete

### Node.js Graceful Shutdown

```javascript
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
```

### Docker Compose Rolling Update

```yaml
deploy:
  update_config:
    order: start-first       # New container starts BEFORE old stops
    failure_action: rollback # Auto-rollback on failure
```

---

## ⚡ Handling ~100 Requests/Second

### Multi-Layer Performance Strategy

| Layer | Mechanism | Benefit |
|-------|-----------|---------|
| **Nginx** | `least_conn` load balancing | Distributes to least busy upstream |
| **Nginx** | `limit_req` rate limiting | 100 req/s protection |
| **Nginx** | `keepalive 32` | Warm connections, no TCP overhead |
| **Node.js** | Non-blocking event loop | Concurrent I/O handling |
| **Docker** | Scalable replicas | Horizontal scaling |

### Nginx Configuration

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

upstream app_backend {
    least_conn;
    server app:3000;
    keepalive 32;
}

server {
    listen 80;
    location / {
        limit_req zone=api burst=50;
        proxy_pass http://app_backend;
    }
}
```

### Load Test Command

```bash
# Apache Bench: 1000 requests, 100 concurrent
ab -n 1000 -c 100 http://<server-ip>/status

# Expected Results:
# Requests per second: ~100+
# Failed requests: 0
# Time per request: ~10ms
```

---

## 📊 Logging & Monitoring

### Application Logs (Winston JSON Format)

Structured logging in JSON for easy parsing and searching:

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

### View Logs

```bash
# Application logs
docker compose logs -f app

# Nginx access logs
docker compose logs -f nginx

# Live container stats
docker stats
```

### Prometheus Metrics

Metrics available at `http://localhost:9090/metrics`

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total requests by route/method/status |
| `http_request_duration_seconds` | Histogram | Request latency (P50/P95/P99) |
| `nodejs_process_cpu_seconds_total` | Counter | CPU usage |
| `nodejs_process_resident_memory_bytes` | Gauge | Memory usage |

### Grafana Dashboards

Access Grafana at `http://localhost:3001`

**Features:**
- Real-time request metrics
- Response time visualization
- Error rate tracking
- System resource monitoring

**Setup:**
1. Add Prometheus datasource: `http://prometheus:9090`
2. Import dashboard or create custom dashboard
3. Select metrics to visualize

---

## 🔒 Security

### Code Security

✅ No hardcoded credentials in codebase  
✅ AWS credentials stored in Jenkins Credentials store  
✅ SSH keys excluded via `.gitignore`  
✅ Non-root Docker containers (UID 1001)  
✅ Health checks for deployment verification  

### Infrastructure Security

✅ SSH access controlled via EC2 key pair  
✅ Security Groups restrict port access  
✅ IAM Roles for least privilege access  
✅ VPC isolation for network security  

### Git Ignore

```
# Sensitive files
*.pem
*.tfstate
*.tfstate.backup
.terraform/
.env
node_modules/
```

---

## 📂 Project Structure

```
devops-api/
├── app/
│   ├── server.js              # Express API server
│   ├── server.test.js         # Jest unit tests (6 tests)
│   ├── package.json           # Node.js dependencies
│   └── Dockerfile             # Multi-stage production image
│
├── nginx/
│   └── nginx.conf             # Reverse proxy configuration
│
├── monitoring/
│   └── prometheus.yml         # Prometheus scrape config
│
├── terraform/
│   └── main.tf                # AWS infrastructure code
│
├── Jenkinsfile                # CI/CD pipeline definition
├── docker-compose.yml         # Local development setup
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

---

## ✨ Bonus Features Implemented

| Feature | Technology | Status |
|---------|-----------|--------|
| Infrastructure as Code | Terraform | ✅ |
| Container Registry | AWS ECR | ✅ |
| Monitoring & Dashboards | Prometheus + Grafana | ✅ |
| Security Best Practices | Non-root containers, secrets management | ✅ |
| Health Checks | Docker HEALTHCHECK + `/health` endpoint | ✅ |
| Graceful Shutdown | SIGTERM handling in Node.js | ✅ |
| Rate Limiting | Nginx 100 req/s with burst | ✅ |
| Structured Logging | Winston JSON format | ✅ |

---

## 🛠️ Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm start

# With Docker Compose
docker compose up -d
```

### Deployment Flow

1. **Push to GitHub** → Triggers Jenkins webhook
2. **Jenkins tests & builds** → Docker image created
3. **Image pushed to ECR** → AWS container registry
4. **Deploy to EC2** → Docker Compose pulls and runs
5. **Health check** → Verifies service is running
6. **Done** → Zero-downtime deployment complete

### Monitoring

- **Prometheus**: `http://localhost:9090` - Metrics storage
- **Grafana**: `http://localhost:3001` - Dashboards and alerts
- **Jenkins**: `http://localhost:8080` - CI/CD pipeline
- **API**: `http://localhost` - Application endpoint

---

## 📝 Testing

All tests are automated with Jest and run on every commit:

```bash
cd app
npm test
```

**Test Coverage:**
- ✓ GET /status endpoint
- ✓ GET /health endpoint
- ✓ POST /data validation
- ✓ GET /data/:id retrieval
- ✓ Error handling
- ✓ Request validation

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Push to GitHub
6. Create a Pull Request

---

## 📄 License

This project is part of a DevOps practical task.

---

## 📞 Support

For issues or questions:
- Check existing GitHub Issues
- Review the CI/CD logs in Jenkins
- Check application logs: `docker compose logs app`

---

## 🎯 Next Steps

- [ ] Set up SSL/TLS certificates
- [ ] Implement auto-scaling
- [ ] Add email alerts in Grafana
- [ ] Set up log aggregation (ELK Stack)
- [ ] Implement disaster recovery plan
- [ ] Add API rate limiting per user

---

**Last Updated:** May 6, 2026