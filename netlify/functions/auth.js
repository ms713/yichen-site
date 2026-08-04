// Decap CMS GitHub OAuth 云函数（implicit flow）
// 流程：
//   1. Decap 从 /admin/ 直接跳转浏览器到 /api/auth（带 response_type=token、redirect_uri=/admin/、client_id、state）
//   2. 本函数把请求参数透传给 GitHub（保持 redirect_uri=/admin/）
//   3. 用户在 GitHub 授权
//   4. GitHub 把 access_token 放到 /admin/#access_token=... 让 Decap 读取
// 关键：OAuth App 的 Authorization callback URL 必须设为 https://yinchen.netlify.app/admin/

const BASE = "https://yinchen.netlify.app";
const ADMIN_URL = BASE + "/admin/";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "Ov23lihuWlVNs5RTZ7cI";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "726d61a366d199f7f2a7b7fd81787c92c19f79f7";

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const code = qs.code;
  const error = qs.error;
  const responseType = qs.response_type;

  // ============ 情况 1: Decap 初次跳转进来（implicit flow）============
  // 透传所有参数到 GitHub，redirect_uri 保持为 /admin/
  if (!code && !error && responseType === "token") {
    const gh = new URL("https://github.com/login/oauth/authorize");
    gh.searchParams.set("client_id", qs.client_id || CLIENT_ID);
    // 规范化 redirect_uri：去掉末尾斜杠
    // GitHub OAuth App callback URL 存储时会规范化末尾斜杠（/admin/ 存为 /admin）
    // Decap 发的可能是 /admin/，所以统一去掉斜杠以确保匹配
    let redirectUri = qs.redirect_uri || ADMIN_URL;
    redirectUri = redirectUri.replace(/\/+$/, "");
    gh.searchParams.set("redirect_uri", redirectUri);
    gh.searchParams.set("response_type", "token");
    gh.searchParams.set("scope", qs.scope || "repo");
    if (qs.state) gh.searchParams.set("state", qs.state);
    if (qs.prompt) gh.searchParams.set("prompt", qs.prompt);
    if (qs.resource) gh.searchParams.set("resource", qs.resource);
    gh.searchParams.set("allow_signup", "false");

    return {
      statusCode: 302,
      headers: { Location: gh.toString() },
      body: ""
    };
  }

  // ============ 情况 2: 兼容旧版 authorization code flow（保留备用）============
  // Decap 默认行为：用 code flow，弹窗 + postMessage
  if (!code && !error && !responseType) {
    const gh = new URL("https://github.com/login/oauth/authorize");
    gh.searchParams.set("client_id", CLIENT_ID);
    gh.searchParams.set("redirect_uri", BASE + "/api/auth"); // 回调到本函数
    gh.searchParams.set("response_type", "code");
    gh.searchParams.set("scope", qs.scope || "repo");
    if (qs.state) gh.searchParams.set("state", qs.state);
    gh.searchParams.set("allow_signup", "false");

    return {
      statusCode: 302,
      headers: { Location: gh.toString() },
      body: ""
    };
  }

  // ============ 情况 3: GitHub 回调带 code（旧 code flow 路径）============
  if (code) {
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: BASE + "/api/auth"
        })
      });
      const data = await tokenRes.json();

      if (data.access_token) {
        // 把 token 用 window.opener.location 传给父窗口（适用于 popup + same-origin）
        const token = data.access_token;
        const scope = data.scope || "repo";
        const tokenType = data.token_type || "bearer";

        const html = `<!doctype html><html><head><meta charset="utf-8"><title>登录成功</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a1422;color:#fff;}</style>
</head><body>
<p>登录成功，正在返回后台…</p>
<script>
(function(){
  var token = ${JSON.stringify(token)};
  var scope = ${JSON.stringify(scope)};
  var tokenType = ${JSON.stringify(tokenType)};
  var adminUrl = ${JSON.stringify(ADMIN_URL)};
  var hash = '#access_token=' + encodeURIComponent(token) + '&token_type=' + tokenType + '&scope=' + scope + '&provider=github';

  // 方法 1: postMessage 给 Decap（它会监听 'authorization:github:success'）
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'authorization:github:success', token: token, provider: 'github' }, '*');
    }
  } catch(e) {}

  // 方法 2: 用 window.opener.location 把父窗口带到 /admin/#access_token=...
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = adminUrl + hash;
      setTimeout(function(){ window.close(); }, 300);
      return;
    }
  } catch(e) {}

  // 方法 3: 当前窗口直接跳
  window.location.href = adminUrl + hash;
})();
</script>
</body></html>`;
        return {
          statusCode: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
          body: html
        };
      }

      return errPage("GitHub 未返回 access_token", JSON.stringify(data));
    } catch (e) {
      return errPage("换取 token 失败", e.message);
    }
  }

  // ============ 情况 4: GitHub 返回 error ============
  if (error) {
    return errPage(`GitHub 授权失败: ${error}`, qs.error_description || "");
  }

  return errPage("未知请求", JSON.stringify(qs));
};

function errPage(title, detail) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2;color:#7f1d1d;padding:20px;text-align:center;}
h1{margin:0 0 12px;font-size:22px;}p{color:#666;font-size:14px;}a{color:#2563eb;margin-top:24px;}</style>
</head><body>
<h1>${title}</h1>
<p>${detail}</p>
<a href="${ADMIN_URL}">← 返回后台重试</a>
</body></html>`
  };
}
