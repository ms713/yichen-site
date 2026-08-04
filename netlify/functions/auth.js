// Decap CMS GitHub OAuth 云函数
// ============================================================
// 完整方案：处理 NetlifyAuthenticator 弹窗协议 + implicit flow
//
// 弹窗协议（Decap 默认走的流程）：
//   1. 父窗口打开弹窗到 /api/auth?provider=github&site_id=...&scope=repo
//   2. 本函数返回 HTML（不是 302），里面 JS：
//      a. 发 'authorizing:github' 给父窗口（NetlifyAuthenticator 协议要求）
//      b. 跳到 GitHub implicit flow (redirect_uri = /api/auth)
//   3. 用户在 GitHub 授权
//   4. GitHub 跳回 /api/auth#access_token=...&scope=...
//   5. 同一 HTML 加载，JS 检测到 hash 里的 access_token：
//      a. 发 'authorization:github:success:{token,provider,scope}' 给父窗口
//      b. 关闭弹窗
//
// implicit flow（备用：如果 Decap 改成 ImplicitAuthenticator，直接走 response_type=token）
// ============================================================

const BASE = "https://yinchen.netlify.app";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "Ov23lihuWlVNs5RTZ7cI";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "726d61a366d199f7f2a7b7fd81787c92c19f79f7";

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};

  // ============ 弹窗入口（NetlifyAuthenticator 打开 ?provider=github）============
  if (qs.provider === "github") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: popupHtml()
    };
  }

  // ============ implicit flow（response_type=token）============
  if (qs.response_type === "token") {
    let redirectUri = qs.redirect_uri || BASE + "/admin/";
    redirectUri = redirectUri.replace(/\/+$/, ""); // 去掉末尾斜杠
    const gh = new URL("https://github.com/login/oauth/authorize");
    gh.searchParams.set("client_id", qs.client_id || CLIENT_ID);
    gh.searchParams.set("redirect_uri", redirectUri);
    gh.searchParams.set("response_type", "token");
    gh.searchParams.set("scope", qs.scope || "repo");
    if (qs.state) gh.searchParams.set("state", qs.state);
    gh.searchParams.set("allow_signup", "false");
    return {
      statusCode: 302,
      headers: { Location: gh.toString() },
      body: ""
    };
  }

  // ============ 旧 explicit code flow 兼容（不应该走这里）============
  if (qs.code) {
    return handleCodeFlow(qs);
  }

  // ============ GitHub implicit flow 回调 ============
  // 关键坑：implicit flow 的 token 在 URL 的 #fragment 里，浏览器不会把 fragment 发给服务器。
  // 所以 GitHub 跳回 /api/auth#access_token=... 时，服务器收到的请求没有任何 query 参数。
  // 这种情况必须返回 popupHtml，让其中的 JS 读取 window.location.hash 并发 success 给父窗口。
  if (qs.error) {
    return errPage("GitHub 授权失败：" + (qs.error_description || qs.error), "");
  }
  // 兜底：任何其余请求（含 GitHub 回调）都返回 popupHtml
  return popupHtml();
};

async function handleCodeFlow(qs) {
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: qs.code,
        redirect_uri: BASE + "/api/auth"
      })
    });
    const data = await tokenRes.json();
    if (data.access_token) {
      return successPage(data.access_token, data.scope || "repo", data.token_type || "bearer");
    }
    return errPage("GitHub 未返回 access_token", JSON.stringify(data));
  } catch (e) {
    return errPage("换取 token 失败", e.message);
  }
}

// 弹窗页面 HTML：处理整个 OAuth 流程
function popupHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <title>登录中...</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f6f8fa; color: #24292f; }
    .box { text-align: center; padding: 32px; }
    .err { color: #cf222e; }
  </style>
</head>
<body>
<div class="box" id="status">正在跳转到 GitHub 授权...</div>
<script>
(function() {
  var PARENT_ORIGIN = "${BASE}";
  var CLIENT_ID = ${JSON.stringify(CLIENT_ID)};

  // 检查当前 URL 的 hash：如果是 GitHub 回调（带 access_token），执行第 4 步
  var hash = window.location.hash;
  if (hash && hash.indexOf("access_token") !== -1) {
    var hashStr = hash.charAt(0) === "#" ? hash.substring(1) : hash;
    var params = new URLSearchParams(hashStr);
    var token = params.get("access_token");
    var scope = params.get("scope") || "repo";
    var tokenType = params.get("token_type") || "bearer";

    if (token) {
      var data = JSON.stringify({ token: token, provider: "github", scope: scope });
      document.getElementById("status").innerHTML = "<p>登录成功，正在返回后台...</p>";

      // 主路径：postMessage 给父窗口（NetlifyAuthenticator 协议要求）
      var posted = false;
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage("authorization:github:success:" + data, PARENT_ORIGIN);
          posted = true;
        } catch (e) {
          console.error("postMessage failed", e);
        }
      }
      // 兜底：写入 localStorage（主路径成功则清掉，避免下次误触发）
      // 父窗口的 storage 事件监听器会接管登录，即便 window.opener 为 null 也能进后台
      try {
        if (posted) localStorage.removeItem("decap_oauth_token");
        else localStorage.setItem("decap_oauth_token", data);
      } catch (e) {}

      setTimeout(function() { try { window.close(); } catch(e) {} }, 400);
      return;
    }

    document.getElementById("status").innerHTML = '<p class="err">授权失败：未获取到 token</p>';
    return;
  }

  // 否则：第 1 步 + 第 2 步
  // 1) 发 authorizing:github 给父窗口
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage("authorizing:github", PARENT_ORIGIN);
    } catch (e) {
      console.error("handshake postMessage failed", e);
    }
  }

  // 2) 跳到 GitHub implicit flow（callback = 当前页面 URL）
  var redirectUri = PARENT_ORIGIN + "/api/auth";
  var scope = new URLSearchParams(window.location.search).get("scope") || "repo";
  var authURL = "https://github.com/login/oauth/authorize?client_id=" + encodeURIComponent(CLIENT_ID) +
                "&redirect_uri=" + encodeURIComponent(redirectUri) +
                "&response_type=token&scope=" + encodeURIComponent(scope) +
                "&allow_signup=false";
  window.location.assign(authURL);
})();
</script>
</body>
</html>`;
}

function successPage(token, scope, tokenType) {
  const hash = "#access_token=" + encodeURIComponent(token) +
               "&token_type=" + tokenType +
               "&scope=" + scope +
               "&provider=github";
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <title>登录成功</title>
  <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a1422;color:#fff;}</style>
</head>
<body>
<p>登录成功，正在返回后台…</p>
<script>
(function(){
  var adminUrl = ${JSON.stringify(BASE + "/admin/")};
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.location.href = adminUrl + ${JSON.stringify(hash)};
    } catch(e) {}
    setTimeout(function(){ window.close(); }, 300);
    return;
  }
  window.location.href = adminUrl + ${JSON.stringify(hash)};
})();
</script>
</body>
</html>`
  };
}

function errPage(title, detail) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2;color:#7f1d1d;padding:20px;text-align:center;}
h1{margin:0 0 12px;font-size:22px;}p{color:#666;font-size:14px;}a{color:#2563eb;margin-top:24px;}</style>
</head><body>
<h1>${title}</h1>
<p>${detail}</p>
<a href="${BASE}/admin/">← 返回后台重试</a>
</body></html>`
  };
}