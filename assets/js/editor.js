/* 尹辰官网 · 前台所见即所得编辑器
 * 入口：website/edit.html
 * 流程：登录(PAT) → 拉 content.json(GitHub API) → YC.render + YC.enableEdit → 点哪改哪 → 发布到 GitHub
 * 功能：文字点选编辑、图片替换 + 尺寸元数据(比例/焦点/宽度)调整、模块内列表项增删、撤销、模块增删移、发布
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

  /* 图片尺寸元数据可选值 */
  var RATIOS = ['760/1280', '16/9', '4/3', '1/1', '809/520', '3/4', '21/9'];
  var POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'];
  var WIDTHS = ['full', 'half', 'third'];
  var SPAN_MAP = { full: 'span 3', half: 'span 2', third: 'span 1' };

  /* 属于"内容列表"的字段（可增删项） */
  var LIST_KEYS = { btns: 1, bio: 1, advCards: 1, list: 1, topics: 1, cards: 1, deliver: 1, tags: 1, testi: 1, posters: 1 };

  var state = { pat: null, data: null, sha: null, dirty: false, undoStack: [] };

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

  /* 判断某 data-yc-path 是否落在"内容列表"里，返回 {arrayPath, index, field, key, isList}
   * 规则：数字必须紧跟在"内容列表字段名"(btns/list/posters…) 之后才算，避免把模块序号 modules.N 误判 */
  function parentArrayInfo(path) {
    var segs = path.split('.');
    for (var i = 0; i < segs.length - 1; i++) {
      if (/^\d+$/.test(segs[i + 1]) && LIST_KEYS[segs[i]]) {
        return {
          arrayPath: segs.slice(0, i + 1).join('.'),
          index: parseInt(segs[i + 1], 10),
          field: segs[i + 2],
          key: segs[i],
          isList: true
        };
      }
    }
    return null;
  }

  /* 给数组新增一项时的空白默认值（参照同数组首元素结构） */
  function defaultItem(arr) {
    if (!arr || !arr.length) return '';
    var s = arr[0];
    if (typeof s === 'string') return '';
    if (Array.isArray(s)) return [];
    if (s && typeof s === 'object') {
      var o = {};
      for (var k in s) {
        if (k === 'poster' || k === 'image') o[k] = '';
        else if (k === 'ratio') o[k] = '760/1280';
        else if (k === 'position') o[k] = 'center';
        else if (k === 'width') o[k] = 'third';
        else if (k === 'icon' || k === 'alt') o[k] = false;
        else o[k] = '';
      }
      return o;
    }
    return '';
  }

  /* ====== 撤销（JSON 快照栈） ====== */
  function pushUndo() {
    try { state.undoStack.push(JSON.stringify(state.data)); } catch (e) {}
    if (state.undoStack.length > 40) state.undoStack.shift();
  }
  function undo() {
    if (!state.undoStack.length) return;
    var prev = state.undoStack.pop();
    try { state.data = JSON.parse(prev); } catch (e) { return; }
    if (!state.undoStack.length) state.dirty = false;
    rerender();
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
        state.undoStack = [];
        updateDirtyBadge();
        btn.disabled = false; btn.textContent = '发布到 GitHub';
        alert('✅ 已发布！约 30 秒后前台自动更新。');
      })
      .catch(function (err) {
        btn.disabled = false; btn.textContent = '发布到 GitHub';
        alert('❌ 发布失败：' + err.message);
      });
  }

  /* ====== 编辑绑定（事件代理） ====== */
  function bindEditors(root) {
    root.addEventListener('click', onClickEditable, true);
  }
  function onClickEditable(e) {
    var node = e.target.closest && e.target.closest('[data-yc-type]');
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    if (node.getAttribute('data-yc-type') === 'text') editText(node, node.getAttribute('data-yc-path'));
    else if (node.getAttribute('data-yc-type') === 'image') openImagePopup(node, node.getAttribute('data-yc-path'));
  }

  /* ---- 文字点选编辑 ---- */
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
      pushUndo();
      setByPath(state.data, path, input.value);
      markDirty();
    }
    function cancel() { canceled = true; node.textContent = original; }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && !isMulti) { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
    });
    /* 列表项增删工具条 */
    var info = parentArrayInfo(path);
    if (info && info.isList) showListBar(node, info);
  }

  /* ---- 浮动：列表项 ＋/－ 工具条 ---- */
  var listBarEl = null;
  function closeListBar() { if (listBarEl) { listBarEl.remove(); listBarEl = null; } }
  function mkBtn(txt, color) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'font-size:12px;padding:4px 10px;border:1px solid ' + color + ';background:#fff;color:' + color + ';border-radius:5px;cursor:pointer;font-family:inherit;';
    b.onmousedown = function (e) { e.preventDefault(); }; /* 保持输入框聚焦，避免 blur 先关掉工具条 */
    return b;
  }
  function showListBar(node, info) {
    closeListBar();
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;z-index:2000;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:5px;display:flex;gap:5px;';
    var add = mkBtn('＋ 添加一项', '#1d9e75');
    add.onclick = function () { addListItem(info.arrayPath); };
    var del = mkBtn('－ 删除本项', '#c0392b');
    del.onclick = function () { removeListItem(info.arrayPath, info.index); };
    bar.appendChild(add); bar.appendChild(del);
    document.body.appendChild(bar);
    var r = node.getBoundingClientRect();
    bar.style.left = Math.max(8, Math.min(window.innerWidth - 170, r.left)) + 'px';
    bar.style.top = (r.bottom + 6) + 'px';
    listBarEl = bar;
    var inp = node.querySelector('input,textarea');
    if (inp) inp.addEventListener('blur', function () { setTimeout(closeListBar, 150); });
  }
  function addListItem(arrayPath) {
    pushUndo();
    var arr = getByPath(state.data, arrayPath);
    if (!Array.isArray(arr)) return;
    arr.push(defaultItem(arr));
    markDirty(); rerender(); closeListBar();
  }
  function removeListItem(arrayPath, index) {
    var arr = getByPath(state.data, arrayPath);
    if (!Array.isArray(arr) || !arr.length) return;
    if (!confirm('删除这一项？')) return;
    pushUndo();
    arr.splice(index, 1);
    markDirty(); rerender(); closeListBar();
  }

  /* ---- 图片编辑弹窗（替换 + 尺寸元数据 + 海报增删） ---- */
  var imgPopupEl = null;
  function closeImagePopup() { if (imgPopupEl) { imgPopupEl.remove(); imgPopupEl = null; } }
  function applyImgLocal(img, p) {
    if (!img || !p) return;
    img.style.aspectRatio = (p.ratio || '760/1280').replace('/', ' / ');
    img.style.objectPosition = p.position || 'center';
    img.style.objectFit = 'cover';
  }
  function applyWidthLocal(img, width) {
    var fig = img.closest && img.closest('.poster-wrap');
    if (!fig) return;
    fig.classList.remove('poster-full', 'poster-half', 'poster-third');
    fig.classList.add('poster-' + width);
    fig.style.gridColumn = SPAN_MAP[width] || 'span 1';
  }
  function openImagePopup(node, path) {
    closeImagePopup();
    var parentPath = path.replace(/\.[^.]+$/, '');
    var parent = getByPath(state.data, parentPath) || {};
    var p = document.createElement('div');
    p.id = 'ycImgPopup';
    p.style.cssText = 'position:fixed;z-index:2001;background:#fff;color:#1a1a1a;border:1px solid #ddd;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.25);padding:12px;width:232px;font-size:13px;';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:600;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
    h.appendChild(document.createTextNode('图片编辑'));
    var x = document.createElement('span'); x.textContent = '×'; x.style.cssText = 'cursor:pointer;color:#999;font-size:18px;line-height:1;'; x.onclick = closeImagePopup; h.appendChild(x);
    p.appendChild(h);
    var up = document.createElement('button');
    up.textContent = '📷 替换图片';
    up.style.cssText = 'display:block;width:100%;margin-bottom:8px;padding:7px;border:1px solid #1d9e75;background:#1d9e75;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;';
    up.onclick = function () { doUploadImage(node, path); };
    p.appendChild(up);
    function addSelect(label, key, opts) {
      if (!(key in parent)) return;
      var lab = document.createElement('label');
      lab.style.cssText = 'display:block;margin:9px 0 2px;font-size:12px;color:#555;';
      lab.appendChild(document.createTextNode(label));
      var sel = document.createElement('select');
      sel.style.cssText = 'width:100%;padding:4px;border:1px solid #ccc;border-radius:5px;font-size:13px;';
      (opts || []).forEach(function (o) {
        var op = document.createElement('option'); op.value = o; op.textContent = o;
        if (o === (parent[key] || '')) op.selected = true;
        sel.appendChild(op);
      });
      sel.onchange = function () {
        pushUndo();
        setByPath(state.data, parentPath + '.' + key, sel.value);
        applyImgLocal(node, getByPath(state.data, parentPath));
        if (key === 'width') applyWidthLocal(node, sel.value);
        markDirty();
      };
      lab.appendChild(sel); p.appendChild(lab);
    }
    addSelect('显示比例', 'ratio', RATIOS);
    addSelect('焦点位置', 'position', POSITIONS);
    addSelect('占行宽度', 'width', WIDTHS);
    /* 海报（gallery）可增删 */
    var info = parentArrayInfo(path);
    if (info && info.isList && info.field === 'poster') {
      var bar = document.createElement('div');
      bar.style.cssText = 'margin-top:12px;display:flex;gap:6px;';
      var add = mkBtn('＋ 添加一张', '#1d9e75');
      add.onclick = function () { addListItem(info.arrayPath); closeImagePopup(); };
      var del = mkBtn('－ 删除这张', '#c0392b');
      del.onclick = function () { removeListItem(info.arrayPath, info.index); closeImagePopup(); };
      bar.appendChild(add); bar.appendChild(del);
      p.appendChild(bar);
    }
    document.body.appendChild(p);
    var r = node.getBoundingClientRect();
    p.style.left = Math.max(8, Math.min(window.innerWidth - 248, r.left)) + 'px';
    p.style.top = Math.min(window.innerHeight - 270, Math.max(8, r.bottom + 8)) + 'px';
    imgPopupEl = p;
  }
  function doUploadImage(node, path) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      node.style.opacity = '0.4';
      uploadImage(file).then(function (url) {
        pushUndo();
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
    pushUndo();
    var m = { type: type };
    m[type + '_cfg'] = defaultCfg(type);
    state.data.modules.push(m);
    markDirty();
    rerender();
  }
  function moveModule(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.data.modules.length) return;
    pushUndo();
    var arr = state.data.modules;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    markDirty();
    rerender();
  }
  function deleteModule(i) {
    var m = state.data.modules[i];
    if (!confirm('删除第 ' + (i + 1) + ' 个模块（' + (MODULE_LABELS[m.type] || m.type) + '）？')) return;
    pushUndo();
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

  /* 点页面其它地方关闭浮层 */
  document.addEventListener('click', function (e) {
    if (imgPopupEl && !imgPopupEl.contains(e.target)) closeImagePopup();
    if (listBarEl && !listBarEl.contains(e.target) && !(e.target.closest && e.target.closest('[data-yc-type]'))) closeListBar();
  }, false);
  window.addEventListener('scroll', function () { closeImagePopup(); closeListBar(); }, true);

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
    document.getElementById('undoBtn').onclick = undo;
    document.getElementById('openAddBtn').onclick = function () { openPanel('addPanel'); };
    document.getElementById('closeAddBtn').onclick = function () { closePanel('addPanel'); };
    document.getElementById('openModBtn').onclick = function () { openPanel('modPanel'); };
    document.getElementById('closeModBtn').onclick = function () { closePanel('modPanel'); };
    document.getElementById('logoutBtn').onclick = function () {
      if (state.dirty && !confirm('还有未发布的改动，确定要退出吗？')) return;
      localStorage.removeItem(TOKEN_KEY);
      location.reload();
    };
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); undo();
      }
    });
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
