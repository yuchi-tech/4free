FROM node:22-alpine

ARG TARGETARCH=amd64

RUN apk add --no-cache ca-certificates openssl tzdata unzip wget \
    && case "$TARGETARCH" in \
      amd64) XRAY_ASSET="Xray-linux-64.zip" ;; \
      arm64) XRAY_ASSET="Xray-linux-arm64-v8a.zip" ;; \
      *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && wget -O /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/latest/download/${XRAY_ASSET}" \
    && unzip /tmp/xray.zip xray -d /usr/bin \
    && chmod +x /usr/bin/xray \
    && rm -f /tmp/xray.zip

COPY site /app/site
COPY server /app/server
COPY xray/config.template.json /app/xray/config.template.json
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV WEB_PORT=8080 \
    XRAY_PORT=443 \
    DATA_DIR=/data \
    CONFIG_PATH=/client \
    REALITY_DEST=www.microsoft.com:443 \
    REALITY_SERVER_NAME=www.microsoft.com \
    CLIENT_REMARK=YC4free

WORKDIR /app
EXPOSE 8080 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.WEB_PORT || 8080) + '/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
