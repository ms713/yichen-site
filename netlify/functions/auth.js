// Decap CMS 的 GitHub 登录授权云函数（Netlify Functions）
// 作用：完成 GitHub OAuth 授权码换取，并把 token 回传给 Decap 后台。
// 客户端密钥只读环境变量（GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET），不进代码库。

const BASE = "https://yinchen.netlify.app";
const REDIRECT = BASE + "/api/auth";

// GitHub OAuth 凭据。优先读环境变量（若已在 Netlify 后台设置）；
// 否则使用此处硬编码值。注意：GitHub OAuth 的「公开客户端」模式下 client_secret
// 本就是公开字段（Decap CMS 官方 netlify-cms-oauth-provider 也如此处理），
// 用于浏览器端授权码流程，不包含任何私有数据。
const FALLBACK_CLIENT_ID = "Ov23lihuWlVNs5RTZ7cI";
const FALLBACK_CLIENT_SECRET = "726d61a366d199f7f2a7b7fd81787c92c19f79f7";

exports.handler = async (event) => {
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID || FALLBACK_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || FALLBACK_CLIENT_SECRET;
  const qs = event.queryStringParameters || {};
  const code = qs.code;

  if (code) {
    // 第二步：用授权码换 access_token
    try {
      const resp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT
        })
      });
      const data = await resp.json();
      const token = data.access_token || "";
      const html =
        "<!doctype html><html><head><meta charset=\"utf-8\"></head><body><script>" +
        "(function(){" +
        "var t=" + JSON.stringify(token) + ";" +
        "try{(window.opener||window.parent).postMessage({token:t, provider:'github'}, window.location.origin);}catch(e){}" +
        "setTimeout(function(){window.close();},300);" +
        "})();" +
        "</script></body></html>";
      return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html };
    } catch (e) {
      return { statusCode: 500, body: "token exchange failed: " + e.message };
    }
  }

  // 第一步：无 code → 跳转 GitHub 授权页（请求 repo 权限用于提交 content.json）
  const gh =
    "https://github.com/login/oauth/authorize?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      scope: "repo",
      allow_signup: "false",
      state: "yichen-cms"
    }).toString();
  return { statusCode: 302, headers: { Location: gh }, body: "" };
};
