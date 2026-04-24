#!/bin/bash
# Initialize SSL certificates for Horizon Trader Platform
#
# Usage:
#   Development (self-signed):  ./nginx/init-ssl.sh
#   Production (Let's Encrypt): ./nginx/init-ssl.sh --production your-domain.com your-email@example.com

set -e

DOMAIN="${2:-horizon.example.com}"
EMAIL="${3:-}"
CERTBOT_CONF="./certbot/conf"
CERTBOT_WWW="./certbot/www"

mkdir -p "$CERTBOT_CONF/live/$DOMAIN"
mkdir -p "$CERTBOT_WWW"

if [ "$1" = "--production" ]; then
    if [ -z "$EMAIL" ]; then
        echo "Usage: $0 --production <domain> <email>"
        exit 1
    fi

    echo "Requesting Let's Encrypt certificate for $DOMAIN..."

    docker run --rm \
        -v "$(pwd)/$CERTBOT_CONF:/etc/letsencrypt" \
        -v "$(pwd)/$CERTBOT_WWW:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    echo "Certificate obtained for $DOMAIN"
else
    echo "Generating self-signed certificate for development..."

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTBOT_CONF/live/$DOMAIN/privkey.pem" \
        -out "$CERTBOT_CONF/live/$DOMAIN/fullchain.pem" \
        -subj "/CN=$DOMAIN/O=Horizon Dev/C=ID"

    echo "Self-signed certificate created at $CERTBOT_CONF/live/$DOMAIN/"
    echo ""
    echo "To use Let's Encrypt in production, run:"
    echo "  $0 --production your-domain.com your-email@example.com"
fi
