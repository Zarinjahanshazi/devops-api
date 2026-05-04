## Live Demo

- API: http:
- API Health: 
- Prometheus: 
- Grafana: 

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | System status, version, uptime |
| POST | `/data` | Store data `{"payload": "..."}` |
| GET | `/data/:id` | Retrieve stored data |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

## How to Run Locally

### Prerequisites
- Docker Desktop
- Node.js 20+

### Run with Docker Compose
```bash
docker compose up -d
```

Test:
```bash
curl http://localhost/status
curl -X POST http://localhost/data \
  -H "Content-Type: application/json" \
  -d '{"payload": "hello"}'
```

## Containerization

Multi-stage Dockerfile with 2 stages:
- `deps` — installs production dependencies only
- `production` — minimal Alpine image, non-root user

Security features:
- Non-root user (nodeuser, UID 1001)
- dumb-init for proper signal handling
- Health check built in

## Infrastructure (Terraform)

AWS resources created with Terraform:
- VPC + Subnet + Internet Gateway + Route Table
- EC2 instance (t3.micro, ap-south-1)
- ECR repository for Docker images
- Security Groups (ports: 80, 22, 8080, 9090, 3001)
- IAM Role for EC2 → ECR access

```bash
cd terraform
terraform init
terraform apply
```

Outputs:


## CI/CD Pipeline (Jenkins)

Pipeline stages:
1. Checkout — code pull from GitHub
2. Install Dependencies — npm ci
3. Run Tests — Jest (6 tests)
4. Build Docker Image — multi-stage build
5. Push to ECR — AWS ECR
6. Deploy to EC2 — zero-downtime rolling update

## Zero-Downtime Deployment

Docker Compose rolling update strategy:
- New container starts first
- Health check passes
- Old container stops after new one is ready
- No requests dropped during deployment

## How System Handles ~100 Requests/Second

- Nginx rate limiting: 100r/s per IP
- Nginx load balancing: least_conn algorithm
- Node.js non-blocking event loop
- keepalive 32 upstream connections
- Horizontal scaling ready (increase replicas)

Load test result:
```bash
ab -n 1000 -c 100 http://13.206.84.144/status
# Requests per second: ~100+
# Failed requests: 0
```

## Monitoring

- Prometheus scrapes metrics every 15s
- Grafana dashboard at port 3001
- Application logs in JSON format (Winston)
- Nginx access logs with response time

Metrics available:
- `http_requests_total` — total requests
- `http_request_duration_seconds` — latency

## Project Structure
