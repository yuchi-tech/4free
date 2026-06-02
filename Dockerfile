FROM ghcr.io/xtls/xray-core:latest AS xray

FROM node:22-alpine

RUN apk add --no-cache ca-certificates openssl tzdata

COPY --from=xray /usr/bin/xray /usr/bin/xray
COPY site /app/site
COPY server /app/server
COPY xray/config.template.json /app/xray/config.template.json
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV WEB_PORT=8080 \
    XRAY_PORT=443 \
    DATA_DIR=/data \
    CONFIG_PATH=/client \
    CONFIG_PASSWORD=change-me \
    REALITY_DEST=www.microsoft.com:443 \
    REALITY_SERVER_NAME=www.microsoft.com \
    CLIENT_REMARK=YC4free

WORKDIR /app
EXPOSE 8080 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.WEB_PORT || 8080) + '/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
