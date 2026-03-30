# Ethical Hacking Bot

AI-powered bug bounty agent focused on logic vulnerabilities (IDOR, broken access control, information disclosure).

## Architecture

```
src/
├── agent/        # AI agent core — decision engine, context understanding
├── recon/         # Target reconnaissance (subdomain enum, endpoint discovery)
├── scanner/       # Vulnerability scanners (IDOR, access control, info disclosure)
├── platforms/     # Bug bounty platform integrations (Intigriti, HackerOne, etc.)
├── reporter/      # Automated report generation
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

```bash
# Run the agent on a specific target
python -m src.agent.run --target <program-slug> --platform intigriti

# Monitor new programs across all platforms
python -m src.agent.monitor

# Generate report for a finding
python -m src.reporter.generate --finding <finding-id>
```
