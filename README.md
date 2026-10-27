# Auth Service

A standalone authentication and authorization backend service with refresh token rotation and role-based access control.
I built this project to implement a secure, stateless authentication microservice that handles session tracking in Redis, stores user and audit logs in PostgreSQL, and prevents token theft through automatic session revocation.

## Links

- Live Demo: https://auth-service-demo.onrender.com (Placeholder)
- Swagger API Docs: https://auth-service-demo.onrender.com/docs (Placeholder)

> Note: The live demo is hosted on a free Render web service. It sleeps after 15 minutes of inactivity and takes about 50 seconds to spin up on cold start.

## Features

- User registration with Argon2id password hashing and email uniqueness checks.
- Short-lived 15-minute JWT access tokens and long-lived refresh tokens.
- Refresh token rotation on every use with reuse detection that revokes all active sessions for that user upon suspicious replay.
- User logout that invalidates the session in Redis.
- Role-based access control (ADMIN, RECRUITER, CANDIDATE) with dedicated route protection middleware.
- Redis-backed rate limiting per IP across all routes and per IP/email on login.
- Account lockout for 15 minutes after 5 consecutive failed login attempts.
- Persistent audit logging in PostgreSQL for register, login, lockout, logout, and password change events.
- Password change endpoint that validates the current password and revokes all active refresh tokens.
- Health check endpoint verifying live connectivity to both PostgreSQL and Redis.
- OpenAPI specification with interactive Swagger UI served at `/docs`.

## Tech Stack

- Runtime: Node.js 20, TypeScript
- Web Framework: Express 4
- Primary Database: PostgreSQL with node-postgres (`pg`)
- In-Memory Store & Cache: Redis with `ioredis`
- Password Hashing: Argon2id (`argon2`)
- Tokens: JSON Web Tokens (`jsonwebtoken`)
- Validation: Zod
- Security Headers & CORS: Helmet, CORS
- Logging: Pino
- Testing: Jest, Supertest, ts-jest, ioredis-mock
- Containerization: Multi-stage Dockerfile, Docker Compose
- CI/CD: GitHub Actions (lint, test with Postgres/Redis services, Docker build)

## Architecture

```mermaid
flowchart LR
    Client["Client / Frontend"]
    API["Express API Server"]
    PG[("PostgreSQL Database\n(Users & Audit Logs)")]
    Redis[("Redis\n(Sessions & Rate Limits)")]

    Client -->|"HTTP Requests\n(Bearer Token / JSON)"| API
    API -->|"Persist users, query roles,\nwrite audit logs"| PG
    API -->|"Store token families,\ncheck rate limits & lockouts"| Redis
```

## How the Auth Flow Works

1. Login: A client sends an email and password to `POST /auth/login`. The server verifies the password with Argon2id and generates two tokens: a 15-minute JWT access token containing the user ID, email, and role, and a random refresh token.
2. Refresh Token Family: When a refresh token is issued, the server creates a unique token family ID and token ID in Redis. The user can hold multiple token families (for example, logged in on a phone and a laptop simultaneously).
3. Rotation on Refresh: When the client calls `POST /auth/refresh`, the server checks whether the provided refresh token matches the active token ID stored in Redis for that family. If valid, the server replaces that token ID with a new one and returns a fresh access token and rotated refresh token.
4. Reuse Detection: If an attacker intercepts an old refresh token and attempts to exchange it after the legitimate client has already rotated it, the server detects that the token ID does not match the active state. In response, the server deletes all active token families associated with that user ID from Redis, forcing all devices to re-authenticate.

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 9 or higher
- Docker and Docker Compose (optional, for running containers locally)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/auth-service.git
   cd auth-service
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and Redis via Docker Compose:
   ```bash
   docker compose up -d postgres redis
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Run database migrations:
   ```bash
   npm run build
   node dist/db/migrate.js
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

   The service starts at `http://localhost:3000`. You can access the Swagger UI at `http://localhost:3000/docs`.

### Running with Docker Compose (Full Stack)

To run the application, PostgreSQL, and Redis together in Docker:
```bash
docker compose up --build
```

### Running Tests

The test suite runs with an in-memory database mock and `ioredis-mock`, meaning no external services are required to execute tests:
```bash
npm test
```

To run lint checks:
```bash
npm run lint
```

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP port the server listens on | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated or `*`) | `*` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://auth_user:auth_password@localhost:5432/auth_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key for signing 15-minute access tokens | Min 16 characters |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | Min 16 characters |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `LOGIN_MAX_FAILED_ATTEMPTS` | Failed login attempts before account lockout | `5` |
| `LOGIN_LOCKOUT_DURATION_SECONDS` | Lockout duration in seconds | `900` (15 minutes) |
| `RATE_LIMIT_WINDOW_SECONDS` | Window size for general rate limiter | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per IP in the window | `100` |
| `LOGIN_RATE_LIMIT_MAX_REQUESTS` | Maximum login attempts per IP / email | `10` |
| `LOG_LEVEL` | Pino logger level (`debug`, `info`, `warn`, `error`, `silent`) | `info` |

## API Endpoints

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Checks PostgreSQL and Redis connections |
| `GET` | `/docs` | Public | Interactive Swagger API documentation |
| `POST` | `/auth/register` | Public | Register a new user (`email`, `password`, optional `role`) |
| `POST` | `/auth/login` | Public | Login with credentials, returns access and refresh tokens |
| `POST` | `/auth/refresh` | Public | Rotates refresh token and returns a new access token |
| `POST` | `/auth/logout` | Public | Invalidates the active refresh token session |
| `POST` | `/auth/change-password` | Authenticated | Updates password and revokes all active sessions |
| `GET` | `/me` | Authenticated | Returns the authenticated user's profile |
| `GET` | `/admin/users` | ADMIN only | Returns a list of all registered users |

## Design Decisions

- Why Argon2id: I chose Argon2id over bcrypt because Argon2 won the Password Hashing Competition (PHC) and provides resistance against GPU/ASIC cracking attacks through memory-hard operations. It is configured with 64 MB memory cost and 3 time iterations.
- Why Redis for refresh tokens: Storing refresh token states in Redis gives sub-millisecond lookups on every rotation request without hitting the relational database. It also provides native TTL expiration, eliminating the need for periodic token cleanup jobs.
- Why Refresh Token Rotation: Storing refresh tokens without rotation leaves them vulnerable if leaked. By rotating the token on every single exchange, an old token becomes dead immediately. If that dead token is ever presented again, the system recognizes a token reuse attack and revokes all active sessions for that user.

## Project Structure

```text
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow
├── migrations/
│   └── 001_init.sql             # PostgreSQL schema definition
├── src/
│   ├── config/
│   │   └── env.ts               # Zod environment schema and loader
│   ├── controllers/             # Express route controllers
│   ├── db/                      # PostgreSQL and Redis clients, migration script
│   ├── docs/
│   │   └── openapi.json         # OpenAPI 3.0 specification
│   ├── middleware/              # Auth, RBAC, rate limiter, validation, error handler
│   ├── routes/                  # Modular route definitions
│   ├── services/                # Business logic (auth, tokens, users, security, audit)
│   ├── utils/                   # Crypto, JWT, logger helpers
│   ├── app.ts                   # Express application setup
│   └── server.ts                # Application bootstrap and graceful shutdown
├── tests/                       # Unit and integration tests (32 tests across 8 suites)
├── Dockerfile                   # Multi-stage production container build
├── docker-compose.yml           # App + PostgreSQL + Redis local setup
├── package.json
└── tsconfig.json
```

## Problems I Ran Into

### 1. Handling Refresh Token Invalidation and Concurrency
<!-- TODO: Add notes on how concurrent requests with the same token were handled during rapid tab reloads -->

### 2. Native Module Compilation for Argon2 Across Environments
<!-- TODO: Add notes on building argon2 in multi-stage Docker builds using Debian slim vs Alpine -->

### 3. Rate Limiter Key Isolation in Redis
<!-- TODO: Add notes on isolating IP rate limits from email-based login attempt counters -->

## What I Would Add Next

- Email verification and password reset workflows via one-time tokens.
- Multi-factor authentication (TOTP using authenticator apps).
- Refresh token fingerprinting using client browser fingerprints or IP subnet matching.
- An OAuth2 / OpenID Connect provider layer for social logins (Google, GitHub).
