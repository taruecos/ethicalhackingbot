# Ethical Hacking Bot

Bug bounty scanner focused on logic vulnerabilities (IDOR, broken access control, information disclosure). Dashboard-driven, no AI in the scan path.

## Architecture

```
dashboard/         # Next.js dashboard (UI + API + Prisma)
scan_service.py    # FastAPI scanner microservice
src/
├── recon/         # Target reconnaissance (subdomain enum, endpoint discovery)
├── scanner/       # Vulnerability scanners (IDOR, access control, info disclosure, XSS, SQLi, CSRF, SSRF)
├── scope/         # Scope enforcement
├── reporter/      # Report generation
└── utils/         # Shared utilities (HTTP client, auth, rate limiting)
config/            # Platform configs, scan profiles
tests/             # Test suite
```

## Target Vulnerabilities

1. **IDOR** — Insecure Direct Object References (API ID manipulation)
2. **Broken Access Control** — Unauthorized endpoint access, privilege escalation
3. **Information Disclosure** — Token leaks, internal data in API responses

## Supported Platforms

- Intigriti (primary)
- HackerOne
- Bugcrowd
- YesWeHack
- Immunefi

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp config/config.example.yaml config/config.yaml
# Edit config.yaml with your API keys
```

## Usage

Scans are launched from the Next.js dashboard, which calls `scan_service.py` over HTTP. Run the dashboard and scanner with `docker compose up`.
