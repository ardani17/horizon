# Host-Level Reverse Proxy

A standalone Nginx reverse proxy that routes incoming traffic to Docker-based applications by domain name. SSL is terminated using Cloudflare Origin Certificates — no Let's Encrypt or Certbot needed.

## Architecture

```
Internet → Cloudflare Edge → Host Server (ports 80/443)
                                  │
                            ┌─────┴─────┐
                            │ nginx-proxy│  ← this project
                            └─────┬─────┘
                                  │ proxy-net (Docker bridge)
                        ┌─────────┼─────────┐
                        │         │         │
                   app-a:3000  app-b:8080  app-c:5000
```

The proxy runs as its own Docker Compose project, separate from any application stack. Each app connects to the shared `proxy-net` Docker network. Adding a new app means dropping a config file in `sites/` and reloading — no changes to the proxy container itself.

### Directory Structure

```
proxy/
├── docker-compose.yml          # Proxy container definition
├── nginx.conf                  # Main Nginx config (shared settings, rate limit zones)
├── sites/
│   ├── _default.conf           # Default server block (health check + 444 for unknown domains)
│   ├── horizon.conf            # Horizon Trader Platform site config
│   └── example-template.conf   # Template for adding new apps
├── deploy.sh                   # Deploy and management script
└── README.md                   # This file
```

## Prerequisites

- **Docker** (v20.10+) and **Docker Compose** (v2 recommended, v1 supported)
- **Cloudflare account** with your domain proxied through Cloudflare
- **Cloudflare SSL/TLS mode** set to **Full (Strict)** for each domain
- A **Cloudflare Origin Certificate** for each domain (see next section)

## Generating a Cloudflare Origin Certificate

Cloudflare Origin Certificates are free, valid for up to 15 years, and trusted by Cloudflare's edge servers in Full (Strict) mode.

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) and select your domain.
2. Go to **SSL/TLS → Origin Server**.
3. Click **Create Certificate**.
4. Choose your key type (RSA is fine) and enter the hostnames to cover.
   - For a single domain: `example.com, *.example.com`
   - Or specific subdomains: `app.example.com`
5. Select the certificate validity period (15 years recommended).
6. Click **Create** — Cloudflare shows the **Origin Certificate** and **Private Key**.
   > Copy both immediately. The private key is only shown once.
7. On your server, save the certificate and key:

   ```bash
   sudo mkdir -p /etc/ssl/cloudflare/example.com
   sudo nano /etc/ssl/cloudflare/example.com/cert.pem   # Paste the Origin Certificate
   sudo nano /etc/ssl/cloudflare/example.com/key.pem    # Paste the Private Key
   sudo chmod 600 /etc/ssl/cloudflare/example.com/key.pem
   ```

8. Verify the files are in place:

   ```bash
   ls -la /etc/ssl/cloudflare/example.com/
   # Should show cert.pem and key.pem
   ```

Repeat for each domain that needs its own certificate. A wildcard cert (`*.example.com`) can cover multiple subdomains.

## Deploying the Proxy

1. Clone or copy the `proxy/` directory to your server (e.g., `/root/proxy/`).

2. Make sure your SSL certificates are in place at `/etc/ssl/cloudflare/<domain>/` (see above).

3. Run the deploy script:

   ```bash
   cd /root/proxy
   bash deploy.sh
   ```

   The script will:
   - Validate that SSL certificate files exist
   - Create the `proxy-net` Docker network if it doesn't exist
   - Start the `nginx-proxy` container
   - Wait for the health check to pass (up to 60 seconds)

4. Verify the proxy is running:

   ```bash
   bash deploy.sh status
   ```

### Deploy Script Commands

| Command | Description |
|---|---|
| `bash deploy.sh` | Deploy the proxy (default action) |
| `bash deploy.sh deploy` | Same as above |
| `bash deploy.sh reload` | Validate config and reload Nginx (zero downtime) |
| `bash deploy.sh status` | Show container status and health |
| `bash deploy.sh logs` | Show recent container logs |

## Adding a New Application

Adding an app behind the proxy takes three steps:

### Step 1: Connect Your App to `proxy-net`

In your application's `docker-compose.yml`, declare `proxy-net` as an external network and attach it to the service(s) that need to receive traffic from the proxy:

```yaml
services:
  web:
    image: myapp:latest
    networks:
      - app-internal   # your app's internal network
      - proxy-net      # connect to the proxy

networks:
  app-internal:
    driver: bridge
  proxy-net:
    external: true
    name: proxy-net
```

Only the entry-point service (the one the proxy routes to) needs `proxy-net`. Keep databases and internal services on the app's own network.

### Step 2: Create a Site Config

Copy the template and customize it for your app:

```bash
cp sites/example-template.conf sites/myapp.conf
```

Open `sites/myapp.conf` and:

1. **Uncomment** all the lines (remove the leading `# `).
2. Replace the placeholders:
   - `<DOMAIN>` → your domain, e.g. `app.example.com`
   - `<APP_NAME>` → a short name, e.g. `myapp`
   - `<CONTAINER>:<PORT>` → the Docker container/service name and port on `proxy-net`, e.g. `myapp-web:8080`
3. Adjust location blocks and rate limiting as needed for your app.

Make sure the SSL certificate for this domain is already in place at `/etc/ssl/cloudflare/<DOMAIN>/`.

### Step 3: Reload the Proxy

Test and apply the new configuration:

```bash
bash deploy.sh reload
```

This validates the Nginx config first. If there's a syntax error, the reload is rejected and the existing config keeps running (zero downtime).

### Verification

After reloading, verify your app is reachable:

```bash
curl -I https://app.example.com
```

You should see a `200` response with the expected security headers.

## Troubleshooting

### Container won't start

```bash
bash deploy.sh logs
```

Common causes:
- **SSL certificate files missing** — The deploy script checks for this and prints instructions. Ensure `/etc/ssl/cloudflare/<domain>/cert.pem` and `key.pem` exist.
- **Port 80 or 443 already in use** — Another service (Apache, old Nginx) is binding these ports. Stop it first: `sudo lsof -i :80` to find the culprit.

### Config reload fails

```bash
bash deploy.sh reload
```

If the config is invalid, Nginx prints the error (e.g., missing semicolon, bad directive). The existing config continues serving traffic. Fix the error in the site config file and reload again.

### 502 Bad Gateway

The proxy can reach the domain but not the upstream app. Check:

1. **Is the app running?** `docker ps` — look for your app's container.
2. **Is the app on `proxy-net`?** `docker network inspect proxy-net` — your app's container should be listed.
3. **Is the upstream name correct?** The `server` value in the `upstream` block must match the container name (or Compose service name) exactly.
4. **Is the port correct?** The port in the upstream must match the port the app listens on inside the container, not any published host port.

### 444 Connection Closed (no response)

This means the request hit the default server block — no site config matches the requested domain. Check:

1. The `server_name` in your site config matches the domain exactly.
2. The site config file is in the `sites/` directory and has a `.conf` extension.
3. You ran `bash deploy.sh reload` after adding the config.

### Health check failing

The health endpoint is at `http://localhost:80/health` inside the container. If the container shows as unhealthy:

```bash
docker exec nginx-proxy wget --no-verbose --tries=1 --spider http://localhost:80/health
```

If this fails, check that `sites/_default.conf` is present and not modified — it provides the `/health` endpoint.

### Checking which domains are configured

List all active site configs:

```bash
ls -la sites/*.conf
```

Test the full Nginx configuration:

```bash
docker exec nginx-proxy nginx -t
```
