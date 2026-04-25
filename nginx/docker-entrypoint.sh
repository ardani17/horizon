#!/bin/sh
# Process nginx.conf template
envsubst '${NGINX_RATE_LIMIT_GENERAL} ${NGINX_RATE_LIMIT_API} ${NGINX_RATE_LIMIT_WEBHOOK}' \
    < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Let the default Nginx entrypoint handle templates/ directory
exec /docker-entrypoint.sh "$@"
