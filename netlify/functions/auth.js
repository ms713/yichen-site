// Decap CMS 的 GitHub 登录授权云函数（Netlify Functions）
// 作用：完成 GitHub OAuth 授权码换取，并把 token 回传给 Decap 后台。

const BASE = "https://yinchen.netlify.app";
const REDIRECT = BASE + "/api/auth";

// GitHub OAuth 凭据。优先读环境变量；否则使用硬编码值。
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
      const err = data.error || "";

      if (token) {
        // 成功：postMessage 传 token 回 Decap
        const html =
          "<!doctype html><html><head><meta charset=\"utf-8\"><title>登录成功</title></head>" +
          "<body style=\"font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a1422;color:#fff;\">" +
          "<p>登录成功，正在返回后台…</p>" +
          "<script>(function(){" +
          "var t=" + JSON.stringify(token) + ";" +
          "try{(window.opener||window.parent).postMessage({token:t, provider:'github'}, window.location.origin);}catch(e){}" +
          "setTimeout(function(){window.close();},2000);" +
          "})();" +
          "</script></body></html>";
        return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html };
      } else {
        // 失败：显示错误详情，方便排查
        const errDetail = err || "GitHub 未返回 access_token（可能 code 已过期或凭据不匹配）";
        const html =
          "<!doctype html><html><head><meta charset=\"utf-8\"><title>登录失败</title></head>" +
          "<body style=\"font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a1422;color:#fff;gap:16px;\">" +
          "<h2>登录失败</h2>" +
          "<p style=\"color:#ff6b6b;\">" + errDetail + "</p>" +
          "<p style=\"color:#888;font-size:13px;\">GitHub 返回: " + JSON.stringify(data) + "</p>" +
          "<a href=\"/admin/\" style=\"color:#4a9eff;\">← 返回后台重试</a>" +
          "<script>setTimeout(function(){try{window.close();}catch(e){}},8000);</script>" +
          "</body></html>";
        return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html };
      }
    } catch (e) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: "<!doctype html><html><head><meta charset=\"utf-8\"></head><body style=\"font-family:sans-serif;text-align:center;padding:40px;\">" +
          "<h2>服务器错误</h2><p>" + e.message + "</p>" +
          "<a href=\"/admin/\">← 返回后台重试</a></body></html>"
      };
    }
  }

  // 第一步：无 code → 跳转 GitHub 授权页
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
