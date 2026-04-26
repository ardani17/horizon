# Implementation Plan: Host-Level Reverse Proxy

## Overview

Migrate from per-app Nginx + Certbot to a standalone host-level Nginx reverse proxy using Cloudflare Origin Certificates. This involves creating the proxy project files (docker-compose, nginx configs, deploy script, docs), then modifying the existing Horizon stack to remove its nginx/certbot services and connect to the shared `proxy-net` network.

## Tasks

- [x] 1. Create proxy project core files
  - [x] 1.1 Create `proxy/docker-compose.yml` with the nginx-proxy service
    - Image: `nginx:1.27-alpine`, container name: `nginx-proxy`
    - Ports: `80:80`, `443:443`
    - Volumes: `./nginx.conf:/etc/nginx/nginx.conf:ro`, `./sites/:/etc/nginx/conf.d/:ro`, `/etc/ssl/cloudflare/:/etc/ssl/cloudflare/:ro`
    - Network: `proxy-net` declared as external with `name: proxy-net`
    - Restart policy: `unless-stopped`
    - Healthcheck: `wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1`
    - _Requirements: 1.1, 1.2, 2.3, 3.1_

  - [x] 1.2 Create `proxy/nginx.conf` main configuration
    - Worker processes, logging, gzip compression settings (carry over from existing `nginx/nginx.conf`)
    - Rate limit zone definitions: `general:10m rate=30r/s`, `api:10m rate=10r/s`, `webhook:10m rate=5r/s`
    - `client_max_body_size 50m`
    - `include /etc/nginx/conf.d/*.conf` to load site configs
    - _Requirements: 1.3, 5.6_

  - [x] 1.3 Create `proxy/sites/_default.conf` default server block
    - Port 80 `default_server`: `/health` endpoint returns 200, all other requests return 444
    - Port 443 `default_server` with ssl: returns 444 for unmatched domains
    - Use a self-signed or snake-oil cert path for the default SSL block (Nginx requires ssl_certificate for port 443 listener), or use `ssl_reject_handshake on` if supported
    - _Requirements: 1.4, 1.6_

- [x] 2. Create Horizon site config and template
  - [x] 2.1 Create `proxy/sites/horizon.conf` for the Horizon Trader Platform
    - `server_name` set to the Horizon domain (use variable comment placeholder for the actual domain)
    - SSL termination: `ssl_certificate /etc/ssl/cloudflare/<domain>/cert.pem`, `ssl_certificate_key /etc/ssl/cloudflare/<domain>/key.pem`
    - TLS 1.2 and 1.3 protocols, strong cipher suite, session cache
    - Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Strict-Transport-Security`
    - Upstream blocks: `horizon-frontend:3000`, `horizon-bot:4000`
    - Location blocks (preserve existing routing from `nginx/templates/default.conf.template`):
      - `/api/bot/` → horizon-bot (rate limit: api zone, burst=20)
      - `/webhook/telegram` → horizon-bot (rate limit: webhook zone, burst=10)
      - `/api/credit/` → horizon-frontend (rate limit: api zone, burst=20)
      - `/admin` → horizon-frontend (rate limit: general zone, burst=30)
      - `/_next/static/` → horizon-frontend (Cache-Control: public, max-age=31536000, immutable)
      - `/_next/image` → horizon-frontend (Cache-Control: public, max-age=2592000)
      - Static files `(ico|txt|xml)` → horizon-frontend (Cache-Control: public, max-age=86400)
      - `/` default → horizon-frontend (rate limit: general zone, burst=30, WebSocket upgrade support)
    - All proxy locations set: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Host` headers
    - _Requirements: 1.3, 1.5, 2.1, 2.2, 2.5, 4.4, 5.4, 5.5, 5.6, 5.7_

  - [x] 2.2 Create `proxy/sites/example-template.conf` as a commented-out template
    - Include placeholder comments for: `server_name`, SSL cert paths, upstream service name/port, location blocks
    - Provide inline instructions for customizing each section
    - _Requirements: 4.5, 6.1_

- [x] 3. Checkpoint — Verify proxy config files
  - Ensure all proxy config files are syntactically correct and complete. Review that `horizon.conf` preserves all existing routing rules from the current `nginx/templates/default.conf.template`. Ask the user if questions arise.

- [x] 4. Create proxy deploy script and documentation
  - [x] 4.1 Create `proxy/deploy.sh` deploy and management script
    - Detect docker compose command (support both `docker compose` v2 and `docker-compose` v1)
    - `deploy` (default action): create `/etc/ssl/cloudflare/` directory if missing, validate SSL cert and key files exist (print instructions if missing and exit 1), create `proxy-net` Docker network if it doesn't exist, run `docker-compose up -d --build`, wait for healthy status (up to 60s), print logs and exit 1 on failure
    - `reload` action: run `docker exec nginx-proxy nginx -t` to validate config, then `docker exec nginx-proxy nginx -s reload` — report validation errors if config is invalid
    - `status` action: show container status and health
    - `logs` action: show container logs
    - Use colored output helpers (info, ok, warn, err) consistent with existing `deploy-docker.sh` style
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.2 Create `proxy/README.md` onboarding guide
    - Overview of the proxy architecture
    - Prerequisites: Docker, Docker Compose, Cloudflare Origin Certificate
    - Step-by-step: generating a Cloudflare Origin Certificate and placing files in `/etc/ssl/cloudflare/<domain>/`
    - Step-by-step: deploying the proxy (`bash deploy.sh`)
    - Step-by-step: adding a new application — (a) add `proxy-net` external network to app's docker-compose, (b) copy `example-template.conf` to `sites/<app>.conf` and customize, (c) run `bash deploy.sh reload`
    - Troubleshooting common issues
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. Checkpoint — Review proxy project completeness
  - Ensure the proxy project (`proxy/` directory) is complete with all files: `docker-compose.yml`, `nginx.conf`, `sites/_default.conf`, `sites/horizon.conf`, `sites/example-template.conf`, `deploy.sh`, `README.md`. Ask the user if questions arise.

- [x] 6. Modify Horizon docker-compose.yml
  - [x] 6.1 Remove `nginx` and `certbot` services from `docker-compose.yml`
    - Remove the entire `nginx` service block
    - Remove the entire `certbot` service block
    - _Requirements: 5.1, 5.8, 8.4_

  - [x] 6.2 Add `proxy-net` external network and connect services
    - Add `proxy-net` as an external network in the `networks` section
    - Add `proxy-net` to the `frontend` service's networks list (keep `horizon-net` too)
    - Add `proxy-net` to the `bot` service's networks list (keep `horizon-net` too)
    - Keep `db` on `horizon-net` only (no public exposure)
    - _Requirements: 3.1, 3.2, 3.4, 5.2, 5.3_

- [x] 7. Modify Horizon deploy script (`deploy-docker.sh`)
  - [x] 7.1 Remove SSL/Certbot-related functions and steps
    - Remove `generate_self_signed()` function entirely
    - Remove `request_letsencrypt()` function entirely
    - Remove `SSL_EMAIL` from the `required_vars` array in `check_required_vars()`
    - Remove certbot directory creation (`./certbot/conf`, `./certbot/www`) from `setup_directories()`
    - Remove calls to `generate_self_signed` and `request_letsencrypt` from `main()`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.2 Remove nginx port defaults and update health check
    - Remove `NGINX_HTTP_PORT`, `NGINX_HTTPS_PORT` from `set_defaults()`
    - Remove `NGINX_RATE_LIMIT_GENERAL`, `NGINX_RATE_LIMIT_API`, `NGINX_RATE_LIMIT_WEBHOOK` from `set_defaults()`
    - Update `health_check()` to only check `db`, `bot`, `frontend` (remove `nginx` from services/containers arrays)
    - Update post-deploy instructions to mention the host proxy must be running
    - _Requirements: 5.8, 8.5_

- [x] 8. Update Horizon `.env.example`
  - Remove `SSL_EMAIL` variable and its comments
  - Remove `NGINX_HTTP_PORT` and `NGINX_HTTPS_PORT` variables and their comments
  - Remove the entire "Nginx Rate Limiting" section (`NGINX_RATE_LIMIT_GENERAL`, `NGINX_RATE_LIMIT_API`, `NGINX_RATE_LIMIT_WEBHOOK`)
  - Remove the "Domain & SSL" section header reference to Let's Encrypt, update comment to reflect Cloudflare Origin Certificates
  - Keep `DOMAIN` variable (still needed for app URL construction)
  - _Requirements: 8.3, 8.5_

- [x] 9. Remove old Horizon nginx files
  - Delete `nginx/nginx.conf`
  - Delete `nginx/templates/default.conf.template`
  - Delete `nginx/docker-entrypoint.sh`
  - Delete the `nginx/templates/` directory
  - Delete the `nginx/` directory
  - _Requirements: 5.1_

- [x] 10. Final checkpoint — Verify complete migration
  - Ensure all proxy files are created in `proxy/` directory. Ensure Horizon `docker-compose.yml` no longer has nginx/certbot services and has proxy-net connected. Ensure `deploy-docker.sh` no longer references SSL generation or certbot. Ensure `.env.example` is cleaned up. Ensure old `nginx/` directory files are removed. Ask the user if questions arise.

## Notes

- All proxy files are created in the `proxy/` subdirectory of this workspace for version control. On the server, they live at `/root/proxy/`.
- The Horizon app files (`docker-compose.yml`, `deploy-docker.sh`, `.env.example`) are modified in-place in the workspace root.
- The `proxy-net` Docker network must be created before either the proxy or Horizon stack can start. The proxy's `deploy.sh` handles this automatically.
- Cloudflare Origin Certificates must be manually generated in the Cloudflare dashboard and placed on the server at `/etc/ssl/cloudflare/<domain>/` — this is a manual prerequisite, not an automated task.
- Checkpoints ensure incremental validation between major sections.
- Each task references specific requirements for traceability.
