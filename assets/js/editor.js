/* 尹辰官网 · 前台所见即所得编辑器
 * 入口：website/edit.html
 * 流程：登录(PAT) → 拉 content.json(GitHub API) → YC.render + YC.enableEdit → 点哪改哪 → 发布到 GitHub
 * 依赖：main.js（提供 YC 接口 + RENDERERS + render + 交互绑定）
 */
(function () {
  'use strict';

  var API = 'https://api.github.com/repos/ms713/yichen-site/contents';
  var SITE = 'https://yichen.urchincxj.workers.dev';
  var TOKEN_KEY = 'yc_pat';
  var MODULE_TYPES = ['media', 'about', 'courses', 'system', 'certs', 'flagship', 'clients', 'gallery', 'cta', 'richtext', 'image'];
  var MODULE_LABELS = {
    media: '媒体按钮', about: '关于讲师', courses: '课程', system: '交付系统',
    certs: '资质', flagship: '旗舰案例', clients: '客户评价',
    gallery: '海报墙', cta: '行动号召', richtext: '纯文字', image: '单图'
  };

  var state = { pat: null, data: null, sha: null, dirty: false };

  /* ====== 数据路径 ====== */
  function getByPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setByPath(o, p, v) {
    var keys = p.split('.');
    var cur = o;
    for (var i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] == null) cur[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = v;
  }

  /* ====== GitHub API ====== */
  function ghHeaders() {
    return { 'Authorization': 'token ' + state.pat, 'Accept': 'application/vnd.github.v3+json' };
  }
  function loadContent() {
    return fetch(API + '/content.json', { headers: ghHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + '（请检查 PAT 是否勾选 Contents 写权限）');
        return r.json();
      })
      .then(function (j) {
        state.sha = j.sha;
        state.data = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))));
      });
  }
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result.split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function uploadImage(file) {
    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    var safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
    var name = 'img-' + Date.now() + '-' + Math.floor(Math.random() * 1000) + '.' + safeExt;
    var path = 'assets/images/' + name;
    return readFileAsBase64(file).then(function (b64) {
      return fetch(API + '/' + path, {
        method: 'PUT',
        headers: Object.assign(ghHeaders(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: 'upload ' + name, content: b64, branch: 'main' })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return SITE + '/' + path;
      });
    });
  }
  function publish() {
    if (!state.dirty) { alert('当前没有未保存的改动。'); return; }
    var btn = document.getElementById('publishBtn');
    btn.disabled = true; btn.textContent = '发布中…';
    var json = JSON.stringify(state.data, null, 2);
    var b64;
    try { b64 = btoa(unescape(encodeURIComponent(json))); }
    catch (err) { btn.disabled = false; btn.textContent = '发布到 GitHub'; alert('序列化失败：' + err.message); return; }
    fetch(API + '/content.json', {
      method: 'PUT',
      headers: Object.assign(ghHeaders(), { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message: '通过前台编辑器更新', content: b64, sha: state.sha, branch: 'main' })
    })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + '：' + t); });
        return r.json();
      })
      .then(function (j) {
        state.sha = j.content.sha;
        state.dirty = false;
        updateDirtyBadge();
        btn.disabled = false; btn.textContent = '发布到 GitHub';
        alert('✅ 已发布！约 30 秒后前台自动更新。');
      })
      .catch(function (err) {
        btn.disabled = false; btn.textContent = '发布到 GitHub';
        alert('❌ 发布失败：' + err.message);
      });
  }

  /* ====== 编辑绑定（事件代理）====== */
  function bindEditors(root) {
    root.addEventListener('click', onClickEditable, true);
  }
  function onClickEditable(e) {
    var node = e.target.closest && e.target.closest('[data-yc-type]');
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    if (node.getAttribute('data-yc-type') === 'text') editText(node, node.getAttribute('data-yc-path'));
    else if (node.getAttribute('data-yc-type') === 'image') editImage(node, node.getAttribute('data-yc-path'));
  }

  function editText(node, path) {
    if (node.querySelector('input,textarea')) return;
    var original = node.textContent;
    var isMulti = /\b(text|desc|callout|bio|highlight|message)\b/.test(path) || (node.scrollHeight || 0) > 80;
    var input = isMulti ? document.createElement('textarea') : document.createElement('input');
    if (!isMulti) input.type = 'text';
    input.value = original;
    input.style.cssText = 'width:100%;font:inherit;color:inherit;background:rgba(0,0,0,.04);border:2px solid #1d9e75;border-radius:6px;padding:4px 8px;box-sizing:border-box;min-height:32px;';
    node.textContent = '';
    node.appendChild(input);
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    var canceled = false;
    function save() {
      if (canceled) return;
      node.textContent = input.value;
      setByPath(state.data, path, input.value);
      markDirty();
    }
    function cancel() { canceled = true; node.textContent = original; }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && !isMulti) { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
    });
  }

  function editImage(node, path) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var originalSrc = node.src;
      node.style.opacity = '0.4';
      uploadImage(file).then(function (url) {
        node.src = url;
        setByPath(state.data, path, url);
        markDirty();
        node.style.opacity = '1';
      }).catch(function (err) {
        node.style.opacity = '1';
        alert('上传失败：' + err.message);
      });
    };
    input.click();
  }

  /* ====== 模块管理 ====== */
  function defaultCfg(type) {
    var d = {
      media: { kicker: 'MEDIA & TALKS', title: '', btns: [{ label: '按钮 1', href: '#', icon: true }] },
      about: { heading: '新模块标题', bio: ['段落内容'], callout: '', advCards: [] },
      courses: { heading: '新模块标题', sub: '', list: [{ title: '课程名', desc: '简介' }], topics: [], entBanner: { title: '', desc: '', btn: '' } },
      system: { kicker: 'SYSTEM', heading: '新模块标题', sub: '', cards: [] },
      certs: { heading: '资质', sub: '', highlight: '', list: [] },
      flagship: { kicker: 'FLAGSHIP', heading: '案例标题', text: '', deliver: [], image: '', ratio: '809/520', position: 'center' },
      clients: { heading: '客户评价', sub: '', tags: [], testi: [{ text: '', who: '' }] },
      gallery: { kicker: 'SHARING & TALKS', heading: '海报墙', posters: [] },
      cta: { heading: '现在联系', sub: '' },
      richtext: { heading: '新模块标题', bio: ['段落'], callout: '' },
      image: { image: '', caption: '', ratio: '16/9', position: 'center', link: '' }
    };
    return d[type] || {};
  }
  function addModule(type) {
    if (!MODULE_TYPES.includes(type)) return;
    var m = { type: type };
    m[type + '_cfg'] = defaultCfg(type);
    state.data.modules.push(m);
    markDirty();
    rerender();
  }
  function moveModule(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.data.modules.length) return;
    var arr = state.data.modules;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    markDirty();
    rerender();
  }
  function deleteModule(i) {
    var m = state.data.modules[i];
    if (!confirm('删除第 ' + (i + 1) + ' 个模块（' + (MODULE_LABELS[m.type] || m.type) + '）？')) return;
    state.data.modules.splice(i, 1);
    markDirty();
    rerender();
  }
  function renderModuleList() {
    var box = document.getElementById('modList');
    if (!box) return;
    box.innerHTML = '';
    state.data.modules.forEach(function (m, i) {
      var row = document.createElement('div'); row.className = 'mod-row';
      var lab = document.createElement('span'); lab.className = 'mod-label';
      lab.textContent = (i + 1) + '. ' + (MODULE_LABELS[m.type] || m.type);
      var tools = document.createElement('span'); tools.className = 'mod-tools';
      function btn(txt, cls, fn) {
        var b = document.createElement('button');
        b.textContent = txt; b.className = cls || ''; b.onclick = fn;
        return b;
      }
      tools.appendChild(btn('↑', '', function () { moveModule(i, -1); }));
      tools.appendChild(btn('↓', '', function () { moveModule(i, +1); }));
      tools.appendChild(btn('×', 'mod-del', function () { deleteModule(i); }));
      row.appendChild(lab); row.appendChild(tools);
      box.appendChild(row);
    });
  }
  function renderAddMenu() {
    var box = document.getElementById('addList');
    if (!box) return;
    box.innerHTML = '';
    MODULE_TYPES.forEach(function (t) {
      var b = document.createElement('button');
      b.textContent = '+ ' + (MODULE_LABELS[t] || t);
      b.onclick = function () { addModule(t); closePanel('addPanel'); };
      box.appendChild(b);
    });
  }

  function markDirty() { state.dirty = true; updateDirtyBadge(); }
  function updateDirtyBadge() {
    var b = document.getElementById('dirtyBadge');
    if (!b) return;
    b.textContent = state.dirty ? '● 有未发布改动' : '○ 无改动';
    b.className = 'dirty-badge ' + (state.dirty ? 'is-dirty' : 'is-clean');
  }
  function rerender() {
    if (window.YC) { window.YC.render(state.data); }
    renderModuleList();
  }
  function openPanel(id) { var p = document.getElementById(id); if (p) p.style.display = ''; }
  function closePanel(id) { var p = document.getElementById(id); if (p) p.style.display = 'none'; }

  /* ====== 入口 ====== */
  function showLogin(errMsg) {
    var loginP = document.getElementById('loginPanel');
    var editP = document.getElementById('editorPanel');
    if (loginP) loginP.style.display = '';
    if (editP) editP.style.display = 'none';
    if (errMsg) document.getElementById('loginErr').textContent = errMsg;
    var btn = document.getElementById('loginBtn');
    var input = document.getElementById('patInput');
    input.value = '';
    btn.onclick = function () {
      var pat = input.value.trim();
      if (!pat) return;
      state.pat = pat;
      btn.disabled = true; btn.textContent = '校验中…';
      loadContent().then(function () {
        localStorage.setItem(TOKEN_KEY, pat);
        showEditor();
      }).catch(function (err) {
        state.pat = null;
        btn.disabled = false; btn.textContent = '登录';
        document.getElementById('loginErr').textContent = '登录失败：' + err.message;
      });
    };
    input.onkeydown = function (e) { if (e.key === 'Enter') btn.click(); };
    setTimeout(function () { input.focus(); }, 100);
  }
  function showEditor() {
    var loginP = document.getElementById('loginPanel');
    var editP = document.getElementById('editorPanel');
    if (loginP) loginP.style.display = 'none';
    if (editP) editP.style.display = '';
    if (window.YC) {
      window.YC.enableEdit();
      window.YC.render(state.data);
      window.YC.initInteractions();
    }
    renderModuleList();
    renderAddMenu();
    updateDirtyBadge();
    bindEditors(document.body);
    document.getElementById('publishBtn').onclick = publish;
    document.getElementById('openAddBtn').onclick = function () { openPanel('addPanel'); };
    document.getElementById('closeAddBtn').onclick = function () { closePanel('addPanel'); };
    document.getElementById('openModBtn').onclick = function () { openPanel('modPanel'); };
    document.getElementById('closeModBtn').onclick = function () { closePanel('modPanel'); };
    document.getElementById('logoutBtn').onclick = function () {
      if (state.dirty && !confirm('还有未发布的改动，确定要退出吗？')) return;
      localStorage.removeItem(TOKEN_KEY);
      location.reload();
    };
  }
  function init() {
    state.pat = localStorage.getItem(TOKEN_KEY);
    if (!state.pat) { showLogin(); return; }
    loadContent().then(showEditor).catch(function (err) {
      localStorage.removeItem(TOKEN_KEY);
      state.pat = null;
      showLogin('登录已失效，请重新粘贴 PAT。');
    });
  }
  init();
})();
