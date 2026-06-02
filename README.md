# YC4free

一个轻量 Docker 镜像：Xray VLESS Reality 服务端 + HTTP 博客 + 密码保护的客户端配置页。

## 功能

- 容器首次启动自动生成 `uuid`、Reality `key`、`shortId`
- 自动生成 Xray 配置并启动服务
- 首页是博客/数据/应用页面
- 访问隐藏路径并输入密码后显示客户端配置
- GitHub 自动构建 Docker 镜像到 GHCR

## DcDeploy 部署

GitHub 推送到 `main` 后会自动构建镜像：

```text
ghcr.io/你的GitHub用户名/yc4free:latest
```

DcDeploy 环境变量：

```env
SERVER_ADDRESS=你的域名
XRAY_PORT=443
WEB_PORT=8080
CONFIG_PATH=/my-client-config
CONFIG_PASSWORD=你的密码
REALITY_DEST=www.microsoft.com:443
REALITY_SERVER_NAME=www.microsoft.com
CLIENT_REMARK=YC4free
```

端口：

```text
8080  博客和配置页
443   Xray Reality
```

建议挂载持久化目录：

```text
/data
```

Cloudflare 域名解析必须使用 `DNS only`，不要开橙色代理。Xray Reality 不是普通 HTTP 服务，Cloudflare 普通代理不能转发它。

## 本地调试博客

只调试博客页面：

```bash
mkdir -p runtime/dev-data
cp .env.example .env
DATA_DIR=runtime/dev-data WEB_PORT=8080 CONFIG_PATH=/my-client-config CONFIG_PASSWORD=change-this-password node server/server.js
```

访问：

```text
http://localhost:8080/
http://localhost:8080/blog.html
```

调试隐藏配置页时，先准备测试数据：

```bash
cat > runtime/dev-data/client.json <<'EOF'
{
  "serverAddress": "localhost",
  "xrayPort": "443",
  "uuid": "00000000-0000-4000-8000-000000000000",
  "protocol": "VLESS",
  "transport": "TCP",
  "security": "Reality",
  "flow": "xtls-rprx-vision",
  "sni": "www.microsoft.com",
  "fingerprint": "chrome",
  "publicKey": "test-public-key",
  "shortId": "0123456789abcdef",
  "remark": "YC4free"
}
EOF
```

然后访问：

```text
http://localhost:8080/my-client-config
```

## 本地完整 Docker 测试

```bash
cp .env.example .env
docker compose up --build
```

访问：

```text
http://localhost:8080/
http://localhost:8080/my-client-config
```

## 文件结构

```text
.
├── Dockerfile
├── docker-compose.yml
├── docker/entrypoint.sh
├── server/server.js
├── site/
├── xray/config.template.json
└── .github/workflows/docker-image.yml
```

## License

MIT
