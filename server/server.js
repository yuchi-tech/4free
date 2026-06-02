const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const siteDir = "/app/site";
const dataDir = process.env.DATA_DIR || "/data";
const clientFile = path.join(dataDir, "client.json");
const port = Number(process.env.WEB_PORT || 8080);
const configPath = normalizePath(process.env.CONFIG_PATH || "/client");
const password = process.env.CONFIG_PASSWORD || "change-me";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function normalizePath(value) {
  const clean = String(value || "/client").trim();
  if (!clean || clean === "/") return "/client";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function send(res, status, body, type = "text/html; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 4096) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function loadClient(hostname) {
  const raw = fs.readFileSync(clientFile, "utf8");
  const data = JSON.parse(raw);
  const serverAddress = data.serverAddress || hostname.split(":")[0];
  const remark = encodeURIComponent(data.remark || "YC4free");
  const link = `vless://${data.uuid}@${serverAddress}:${data.xrayPort}?encryption=none&flow=${data.flow}&security=reality&sni=${data.sni}&fp=${data.fingerprint}&pbk=${data.publicKey}&sid=${data.shortId}&type=tcp&headerType=none#${remark}`;
  return { ...data, serverAddress, link };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loginPage(error = "") {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>客户端配置</title>
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
  <main class="secret-page">
    <form class="secret-box" method="post">
      <h1>客户端配置</h1>
      <p>请输入管理员密码查看连接参数。</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
      <label>
        密码
        <input type="password" name="password" autocomplete="current-password" autofocus>
      </label>
      <button class="button button--primary" type="submit">查看配置</button>
    </form>
  </main>
</body>
</html>`;
}

function configPage(client) {
  const rows = [
    ["地址", client.serverAddress],
    ["端口", client.xrayPort],
    ["UUID", client.uuid],
    ["协议", client.protocol],
    ["传输", client.transport],
    ["安全", client.security],
    ["Flow", client.flow],
    ["SNI", client.sni],
    ["Fingerprint", client.fingerprint],
    ["Public Key", client.publicKey],
    ["Short ID", client.shortId]
  ];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>客户端配置</title>
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
  <main class="config-page">
    <section class="config-panel">
      <p class="eyebrow">VLESS Reality</p>
      <h1>客户端配置</h1>
      <p class="config-note">复制分享链接导入客户端，或按下方参数手动填写。</p>
      <textarea readonly>${escapeHtml(client.link)}</textarea>
      <div class="config-grid">
        ${rows.map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </div>
    </section>
  </main>
</body>
</html>`;
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const fullPath = path.normalize(path.join(siteDir, requested));
  if (!fullPath.startsWith(siteDir)) return null;
  return fullPath;
}

async function handleSecret(req, res) {
  if (req.method === "GET") {
    send(res, 200, loginPage());
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
    return;
  }

  try {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    if (!timingSafeEqual(params.get("password") || "", password)) {
      send(res, 401, loginPage("密码不正确"));
      return;
    }
    send(res, 200, configPage(loadClient(req.headers.host || "")));
  } catch (error) {
    send(res, 500, "Unable to read client configuration", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (req, res) => {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  if (requestPath === "/ready") {
    const ready = fs.existsSync(clientFile);
    send(res, ready ? 200 : 503, ready ? "ready" : "not ready", "text/plain; charset=utf-8");
    return;
  }

  if (requestPath === configPath) {
    await handleSecret(req, res);
    return;
  }

  const fullPath = safeStaticPath(requestPath);
  if (!fullPath) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(fullPath, (error, content) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const type = mimeTypes[path.extname(fullPath)] || "application/octet-stream";
    send(res, 200, content, type);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Blog server ready on port ${port}. Secret config path: ${configPath}`);
});
