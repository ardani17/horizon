# Requirements Document

## Introduction

This feature introduces a host-level Nginx reverse proxy that runs directly on the server (outside of any application's Docker Compose stack) and routes incoming HTTP/HTTPS traffic to multiple Docker-based applications based on domain name. SSL termination is handled using Cloudflare Origin Certificates, eliminating the need for Let's Encrypt/Certbot in each application. The existing Horizon Trader Platform is the first application to be migrated behind this host proxy, with a design that makes adding new applications a simple configuration change.

## Glossary

- **Host_Proxy**: The host-level Nginx reverse proxy instance that runs as a standalone Docker container (or Docker Compose service) on the server, separate from any application stack. It listens on ports 80 and 443 and routes traffic to application containers.
- **App_Stack**: A Docker Compose-based application deployment (e.g., Horizon Trader Platform) that runs its own set of containers on an internal Docker network. Each App_Stack exposes its entry point on an internal HTTP port.
- **Cloudflare_Origin_Certificate**: A free TLS certificate issued by Cloudflare, installed on the origin server, and trusted exclusively by Cloudflare's edge proxies. Valid for up to 15 years.
- **Shared_Network**: A Docker bridge network (e.g., `proxy-net`) that the Host_Proxy and all App_Stacks connect to, enabling container-to-container communication without exposing ports to the host.
- **Site_Config**: An individual Nginx server block configuration file placed in the Host_Proxy's `conf.d/` directory that defines routing rules for a specific domain to its corresponding App_Stack.
- **SSL_Mode**: The Cloudflare SSL/TLS encryption mode configured per domain. This feature targets "Full (Strict)" mode where Cloudflare connects to the origin over HTTPS using a trusted Cloudflare Origin Certificate.

## Requirements

### Requirement 1: Host-Level Reverse Proxy Container

**User Story:** As a server administrator, I want a single Nginx reverse proxy running at the host level, so that all incoming web traffic is routed to the correct application based on domain name.

#### Acceptance Criteria

1. THE Host_Proxy SHALL listen on port 80 and port 443 on the host server.
2. THE Host_Proxy SHALL run as a standalone Docker Compose service, independent of any App_Stack's Docker Compose file.
3. THE Host_Proxy SHALL route incoming HTTPS requests to the correct App_Stack based on the `Host` header (domain name).
4. WHEN an HTTP request is received on port 80, THE Host_Proxy SHALL redirect the request to HTTPS on port 443.
5. THE Host_Proxy SHALL forward the `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `Host` headers to upstream App_Stacks.
6. IF a request arrives for a domain that has no matching Site_Config, THEN THE Host_Proxy SHALL return an HTTP 444 response (connection closed without response).

### Requirement 2: Cloudflare Origin Certificate SSL Termination

**User Story:** As a server administrator, I want to use Cloudflare Origin Certificates for SSL on the origin server, so that I have a trusted HTTPS connection between Cloudflare and my server without managing Let's Encrypt renewals.

#### Acceptance Criteria

1. THE Host_Proxy SHALL terminate TLS using a Cloudflare_Origin_Certificate and its corresponding private key.
2. THE Host_Proxy SHALL support TLS 1.2 and TLS 1.3 protocols.
3. THE Host_Proxy SHALL store the Cloudflare_Origin_Certificate and private key in a dedicated directory on the host (e.g., `/etc/ssl/cloudflare/`), mounted into the Host_Proxy container as a read-only volume.
4. THE Host_Proxy SHALL support using a single wildcard Cloudflare_Origin_Certificate (e.g., `*.example.com`) for multiple subdomains, or individual certificates per domain.
5. WHEN the Cloudflare SSL_Mode is set to "Full (Strict)", THE Host_Proxy SHALL present the Cloudflare_Origin_Certificate so that Cloudflare's edge validates the connection successfully.

### Requirement 3: Shared Docker Network for App Communication

**User Story:** As a server administrator, I want all applications and the host proxy to communicate over an internal Docker network, so that no application ports are exposed directly to the public internet.

#### Acceptance Criteria

1. THE Host_Proxy SHALL create and connect to a Shared_Network named `proxy-net`.
2. WHEN an App_Stack is deployed, THE App_Stack SHALL connect its entry-point service to the `proxy-net` Shared_Network.
3. THE Host_Proxy SHALL proxy traffic to App_Stack services using their Docker container name or service name as the upstream hostname on the Shared_Network.
4. THE App_Stack SHALL expose its entry-point service only on the Shared_Network, without publishing ports to the host.

### Requirement 4: Per-Domain Site Configuration

**User Story:** As a server administrator, I want each domain's routing rules defined in a separate configuration file, so that adding or removing an application requires only adding or removing a single file.

#### Acceptance Criteria

1. THE Host_Proxy SHALL load Site_Config files from a `sites/` directory mounted into the container.
2. WHEN a new Site_Config file is added to the `sites/` directory, THE Host_Proxy SHALL route traffic for the configured domain after a reload command is issued.
3. WHEN a Site_Config file is removed from the `sites/` directory, THE Host_Proxy SHALL stop routing traffic for that domain after a reload command is issued.
4. THE Site_Config file SHALL define the `server_name` (domain), upstream target (App_Stack container/service name and port), and any app-specific location blocks.
5. THE Host_Proxy SHALL provide a documented Site_Config template file that administrators can copy and customize for new applications.

### Requirement 5: Horizon Trader Platform Migration

**User Story:** As a server administrator, I want to migrate the existing Horizon Trader Platform to run behind the host-level proxy, so that it no longer needs its own Nginx container or Certbot for SSL.

#### Acceptance Criteria

1. WHEN the Horizon App_Stack is migrated, THE Horizon docker-compose.yml SHALL remove the `nginx` and `certbot` services.
2. WHEN the Horizon App_Stack is migrated, THE Horizon `frontend` service SHALL connect to the `proxy-net` Shared_Network.
3. WHEN the Horizon App_Stack is migrated, THE Horizon `bot` service SHALL connect to the `proxy-net` Shared_Network.
4. THE Host_Proxy Site_Config for Horizon SHALL route `/api/bot/` and `/webhook/telegram` paths to the Horizon bot service.
5. THE Host_Proxy Site_Config for Horizon SHALL route all other paths (including `/_next/static/`, `/_next/image`, `/admin`, `/api/credit/`) to the Horizon frontend service.
6. THE Host_Proxy Site_Config for Horizon SHALL preserve the existing rate limiting zones (general, api, webhook) with configurable rates.
7. THE Host_Proxy Site_Config for Horizon SHALL preserve the existing caching headers for static assets (`/_next/static/` with 1-year cache, `/_next/image` with 30-day cache).
8. WHEN the Horizon App_Stack is migrated, THE Horizon docker-compose.yml SHALL no longer publish ports 80 or 443 to the host.

### Requirement 6: Easy Application Onboarding

**User Story:** As a server administrator, I want a clear, repeatable process to add a new application behind the host proxy, so that onboarding a new app takes minimal effort.

#### Acceptance Criteria

1. THE Host_Proxy project SHALL include a documented step-by-step guide for adding a new application.
2. THE onboarding guide SHALL cover: creating a Site_Config file from the template, connecting the App_Stack to the Shared_Network, and reloading the Host_Proxy.
3. WHEN a new application is onboarded, THE administrator SHALL only need to: (a) add the App_Stack's external network declaration, (b) create a Site_Config file, and (c) reload the Host_Proxy.
4. THE Host_Proxy SHALL support routing to applications that use different internal ports without modifying the Host_Proxy's core configuration.

### Requirement 7: Deploy Script and Operational Tooling

**User Story:** As a server administrator, I want a deploy script for the host proxy, so that I can set up or update the proxy with a single command.

#### Acceptance Criteria

1. THE Host_Proxy project SHALL include a deploy script that creates required directories, validates the presence of SSL certificates, and starts the Host_Proxy container.
2. WHEN the deploy script is run and SSL certificate files are missing, THE deploy script SHALL display an error message with instructions for generating a Cloudflare_Origin_Certificate.
3. THE deploy script SHALL support reloading the Host_Proxy configuration without downtime by sending a reload signal to the Nginx process.
4. THE deploy script SHALL verify that the Host_Proxy container is healthy after startup.
5. IF the Host_Proxy container fails to start, THEN THE deploy script SHALL display the container logs and exit with a non-zero status code.

### Requirement 8: Removal of Let's Encrypt / Certbot Dependency

**User Story:** As a server administrator, I want to remove the Let's Encrypt/Certbot setup from the Horizon platform, so that SSL is managed entirely through Cloudflare Origin Certificates at the host proxy level.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Horizon deploy script (`deploy-docker.sh`) SHALL remove the self-signed certificate generation step.
2. WHEN the migration is complete, THE Horizon deploy script SHALL remove the Let's Encrypt certificate request step.
3. WHEN the migration is complete, THE Horizon `.env.example` SHALL remove the `SSL_EMAIL` variable.
4. WHEN the migration is complete, THE Horizon docker-compose.yml SHALL remove all certbot-related volume mounts (`./certbot/conf`, `./certbot/www`).
5. WHEN the migration is complete, THE Horizon `NGINX_HTTP_PORT` and `NGINX_HTTPS_PORT` environment variables SHALL be removed from `.env.example` since the Host_Proxy owns ports 80 and 443.
