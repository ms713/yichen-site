/* 尹辰官网 — 交互脚本（模块化版）
   功能：从 content.json 渲染内容（hero + modules 数组 + footer）+ 平滑滚动/移动菜单/入场动画/微信复制/留资弹窗/海报灯箱
   管理后台：访问 /admin/ 编辑内容；带 ?preview=1 时优先读取 localStorage 预览
   注：模块字段统一封装为 m.<type>_cfg，便于后台配置；不修改时按 type 读取对应 cfg */
(function () {
  'use strict';

  var PREVIEW_KEY = 'yc_preview';
  var content = null;

  /* ---------- 小工具 ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function setText(id, v) { var e = document.getElementById(id); if (e && v != null) e.textContent = v; }
  function setImg(id, src) { var e = document.getElementById(id); if (e && src) e.src = src; }

  /* 统一给图片套上比例 / 焦点位置（object-fit: cover） */
  function applyImg(img, ratio, position) {
    img.style.aspectRatio = (ratio || '760/1280').replace('/', ' / ');
    img.style.objectPosition = position || 'center';
    img.style.objectFit = 'cover';
  }

  /* 图片墙（分享海报 / 画廊）：每张图独立 比例/焦点/占行宽度 */
  function renderGallery(container, posters) {
    var spanMap = { full: 'span 3', half: 'span 2', third: 'span 1' };
    (posters || []).forEach(function (item, pi) {
      var src, ratio, position, width, title;
      if (typeof item === 'string') {
        src = item; ratio = '760/1280'; position = 'center'; width = 'third'; title = '';
      } else {
        src = item.poster || '';
        ratio = item.ratio || '760/1280';
        position = item.position || 'center';
        width = item.width || 'third';
        title = item.title || '';
      }
      var wrap = el('figure', 'poster-wrap poster-' + width);
      wrap.style.gridColumn = spanMap[width] || 'span 1';
      var img = el('img', 'poster');
      img.src = src; img.alt = title || '分享海报';
      applyImg(img, ratio, position);
      i(img, 'posters.' + pi + '.poster');
      wrap.appendChild(img);
      if (title) wrap.appendChild(t(el('figcaption', 'poster-caption', title), 'posters.' + pi + '.title'));
      container.appendChild(wrap);
    });
  }

  /* ---------- 模块分发器 ---------- */
  // 固定锚点：导航栏指向的第一个同类型模块
  var anchorMap = { about: 'about', courses: 'courses', certs: 'certs', gallery: 'sharing' };
  var usedAnchor = {};

  /* 编辑模式开关（全局）；仅当通过 ?edit=1 触发时由 editor.js 开启 */
  var Edit = { enabled: false, mi: 0, type: '', cfgKey: '' };
  function t(node, subPath) {
    if (!Edit.enabled || !node) return node;
    node.setAttribute('data-yc-type', 'text');
    node.setAttribute('data-yc-path', 'modules.' + Edit.mi + '.' + Edit.cfgKey + '.' + subPath);
    return node;
  }
  function tHero(node, path) {
    if (!Edit.enabled || !node) return node;
    node.setAttribute('data-yc-type', 'text');
    node.setAttribute('data-yc-path', path);
    return node;
  }
  function i(node, subPath) {
    if (!Edit.enabled || !node) return node;
    node.setAttribute('data-yc-type', 'image');
    node.setAttribute('data-yc-path', 'modules.' + Edit.mi + '.' + Edit.cfgKey + '.' + subPath);
    return node;
  }
  function iHero(node, path) {
    if (!Edit.enabled || !node) return node;
    node.setAttribute('data-yc-type', 'image');
    node.setAttribute('data-yc-path', path);
    return node;
  }

  function modMedia(m) {
    var c = m.media_cfg || {};
    var s = el('section', 'media');
    var w = el('div', 'wrap media-row');
    var left = el('div', 'media-left');
    left.appendChild(t(el('div', 'kicker', 'MEDIA & TALKS'), 'kicker'));
    left.appendChild(t(el('div', 't', c.title || ''), 'title'));
    var btns = el('div', 'media-btns');
    (c.btns || []).forEach(function (b, bi) {
      var a = el('a', 'media-btn' + (b.alt ? ' alt' : ''));
      a.href = b.href || '#'; a.target = '_blank'; a.rel = 'noopener';
      if (b.icon) a.appendChild(el('span', 'play-ic'));
      a.appendChild(t(el('span', null, b.label || ''), 'btns.' + bi + '.label'));
      btns.appendChild(a);
    });
    w.appendChild(left); w.appendChild(btns); s.appendChild(w);
    return s;
  }

  function modAbout(m) {
    var c = m.about_cfg || {};
    var s = el('section', 'about');
    var w = el('div', 'wrap');
    var head = el('div', 'about-head reveal');
    head.appendChild(el('div', 'kicker', 'ABOUT'));
    head.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    w.appendChild(head);
    var bio = el('div', 'about-bio');
    (c.bio || []).forEach(function (tx, bi) { bio.appendChild(t(el('p', 'about-bio reveal', tx), 'bio.' + bi)); });
    w.appendChild(bio);
    if (c.callout) w.appendChild(t(el('div', 'callout reveal', c.callout), 'callout'));
    if (c.advCards) {
      var g = el('div', 'adv-grid');
      c.advCards.forEach(function (card, ci) {
        var d = el('div', 'adv-card reveal');
        d.appendChild(t(el('div', 'adv-ic', card.ic || ''), 'advCards.' + ci + '.ic'));
        d.appendChild(t(el('h3', null, card.title || ''), 'advCards.' + ci + '.title'));
        d.appendChild(t(el('p', null, card.desc || ''), 'advCards.' + ci + '.desc'));
        g.appendChild(d);
      });
      w.appendChild(g);
    }
    s.appendChild(w);
    return s;
  }

  function modCourses(m) {
    var c = m.courses_cfg || {};
    var s = el('section', 'courses');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    top.appendChild(t(el('p', 'sub', c.sub || ''), 'sub'));
    w.appendChild(top);
    var g = el('div', 'course-grid');
    (c.list || []).forEach(function (it, ci) {
      var a = el('a', 'course-card reveal');
      a.href = '#contact';
      a.appendChild(t(el('h3', null, it.title || ''), 'list.' + ci + '.title'));
      a.appendChild(t(el('p', null, it.desc || ''), 'list.' + ci + '.desc'));
      g.appendChild(a);
    });
    w.appendChild(g);
    if (c.topics) {
      var tp = el('div', 'topics reveal');
      tp.appendChild(el('div', 'kicker', '近期热门授课主题'));
      var tt = el('div', 'topic-tags');
      c.topics.forEach(function (tx, ti) { tt.appendChild(t(el('span', 'tag', tx), 'topics.' + ti)); });
      tp.appendChild(tt); w.appendChild(tp);
    }
    if (c.entBanner) {
      var eb = el('div', 'ent-banner reveal');
      var d = el('div');
      d.appendChild(t(el('h3', null, c.entBanner.title || ''), 'entBanner.title'));
      d.appendChild(t(el('p', null, c.entBanner.desc || ''), 'entBanner.desc'));
      eb.appendChild(d);
      var b = el('a', 'btn', c.entBanner.btn || '');
      b.href = '#contact'; b.setAttribute('data-open-modal', '');
      eb.appendChild(b);
      w.appendChild(eb);
    }
    s.appendChild(w);
    return s;
  }

  function modSystem(m) {
    var c = m.system_cfg || {};
    var s = el('section', 'system');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(t(el('div', 'kicker', c.kicker || 'SYSTEM DELIVERY'), 'kicker'));
    top.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    top.appendChild(t(el('p', 'sub', c.sub || ''), 'sub'));
    w.appendChild(top);
    var g = el('div', 'sys-grid');
    (c.cards || []).forEach(function (card, ci) {
      var d = el('div', 'sys-card reveal');
      d.appendChild(t(el('div', 'adv-ic', card.ic || ''), 'cards.' + ci + '.ic'));
      d.appendChild(t(el('h3', null, card.title || ''), 'cards.' + ci + '.title'));
      d.appendChild(t(el('p', null, card.desc || ''), 'cards.' + ci + '.desc'));
      g.appendChild(d);
    });
    w.appendChild(g);
    s.appendChild(w);
    return s;
  }

  function modCerts(m) {
    var c = m.certs_cfg || {};
    var s = el('section', 'certs');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    top.appendChild(t(el('p', 'sub', c.sub || ''), 'sub'));
    w.appendChild(top);
    if (c.highlight) w.appendChild(t(el('div', 'cert-hl reveal', c.highlight), 'highlight'));
    var g = el('div', 'cert-grid reveal');
    (c.list || []).forEach(function (tx, ti) {
      var sp = el('span', 'cert-chip');
      sp.appendChild(el('span', 'dot'));
      sp.appendChild(t(document.createTextNode(tx), 'list.' + ti));
      g.appendChild(sp);
    });
    w.appendChild(g);
    s.appendChild(w);
    return s;
  }

  function modFlagship(m) {
    var c = m.flagship_cfg || {};
    var s = el('section', 'flagship');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(t(el('div', 'kicker', c.kicker || 'FLAGSHIP CASE'), 'kicker'));
    top.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    w.appendChild(top);
    var fg = el('div', 'flag-grid');
    var left = el('div', 'reveal');
    left.appendChild(t(el('p', 'flag-text', c.text || ''), 'text'));
    var dl = el('ul', 'deliver');
    (c.deliver || []).forEach(function (tx, di) {
      var li = el('li');
      li.appendChild(el('span', 'ck', '✓'));
      li.appendChild(t(document.createTextNode(tx), 'deliver.' + di));
      dl.appendChild(li);
    });
    left.appendChild(dl);
    fg.appendChild(left);
    if (c.image) {
      var img = el('img', 'flag-photo reveal');
      img.src = c.image;
      applyImg(img, c.ratio || '809/520', c.position || 'center');
      i(img, 'image');
      fg.appendChild(img);
    }
    w.appendChild(fg);
    s.appendChild(w);
    return s;
  }

  function modClients(m) {
    var c = m.clients_cfg || {};
    var s = el('section', 'clients');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    top.appendChild(t(el('p', 'sub', c.sub || ''), 'sub'));
    w.appendChild(top);
    if (c.tags) {
      var ct = el('div', 'client-tags reveal');
      c.tags.forEach(function (tx, ti) { ct.appendChild(t(el('span', 'client-tag', tx), 'tags.' + ti)); });
      w.appendChild(ct);
    }
    var tg = el('div', 'testi');
    (c.testi || []).forEach(function (tx, ti) {
      var d = el('div', 'testi-card reveal');
      d.appendChild(t(el('p', null, tx.text || ''), 'testi.' + ti + '.text'));
      d.appendChild(t(el('div', 'who', tx.who || ''), 'testi.' + ti + '.who'));
      tg.appendChild(d);
    });
    w.appendChild(tg);
    s.appendChild(w);
    return s;
  }

  function modGallery(m) {
    var c = m.gallery_cfg || {};
    var s = el('section', 'sharing');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('div', 'kicker', c.kicker || 'SHARING & TALKS'));
    top.appendChild(el('h2', 'h-sec', c.heading || ''));
    w.appendChild(top);
    var g = el('div', 'share-grid reveal');
    renderGallery(g, c.posters);
    w.appendChild(g);
    s.appendChild(w);
    return s;
  }

  function modCta(m) {
    var c = m.cta_cfg || {};
    var s = el('section', 'final');
    var w = el('div', 'wrap reveal');
    w.appendChild(t(el('h2', null, c.heading || ''), 'heading'));
    w.appendChild(t(el('p', null, c.sub || ''), 'sub'));
    s.appendChild(w);
    return s;
  }

  function modRichtext(m) {
    var c = m.richtext_cfg || {};
    var s = el('section', 'about');
    var w = el('div', 'wrap');
    var head = el('div', 'about-head reveal');
    head.appendChild(el('div', 'kicker', 'NOTE'));
    head.appendChild(t(el('h2', 'h-sec', c.heading || ''), 'heading'));
    w.appendChild(head);
    var bio = el('div', 'about-bio');
    (c.bio || []).forEach(function (tx, bi) { bio.appendChild(t(el('p', 'about-bio reveal', tx), 'bio.' + bi)); });
    w.appendChild(bio);
    if (c.callout) w.appendChild(t(el('div', 'callout reveal', c.callout), 'callout'));
    s.appendChild(w);
    return s;
  }

  function modImage(m) {
    var c = m.image_cfg || {};
    var s = el('section', 'about mod-image');
    var w = el('div', 'wrap');
    var fig = el('div', 'fig');
    var img = el('img', 'flag-photo');
    img.src = c.image || '';
    img.alt = c.caption || '图片';
    applyImg(img, c.ratio || '16/9', c.position || 'center');
    i(img, 'image');
    fig.appendChild(img);
    if (c.caption) fig.appendChild(t(el('p', 'poster-caption', c.caption), 'caption'));
    if (c.link) {
      var a = el('a');
      a.href = c.link; a.target = '_blank'; a.rel = 'noopener';
      a.appendChild(fig); w.appendChild(a);
    } else {
      w.appendChild(fig);
    }
    s.appendChild(w);
    return s;
  }

  var RENDERERS = {
    media: modMedia, about: modAbout, courses: modCourses, system: modSystem,
    certs: modCerts, flagship: modFlagship, clients: modClients,
    gallery: modGallery, cta: modCta, richtext: modRichtext, image: modImage
  };

  function renderModule(m) {
    var fn = RENDERERS[m.type];
    if (!fn) return null;
    var s = fn(m);
    if (s && anchorMap[m.type] && !usedAnchor[anchorMap[m.type]]) {
      s.id = anchorMap[m.type];
      usedAnchor[anchorMap[m.type]] = true;
    }
    return s;
  }

  /* ---------- 渲染（数据 → DOM） ---------- */
  function render(c) {
    if (c.siteTitle) document.title = c.siteTitle;

    /* Hero（固定） */
    if (c.hero) {
      setText('heroKicker', c.hero.kicker); tHero(document.getElementById('heroKicker'), 'hero.kicker');
      setText('heroTitle', c.hero.title); tHero(document.getElementById('heroTitle'), 'hero.title');
      setText('heroSub', c.hero.sub); tHero(document.getElementById('heroSub'), 'hero.sub');
      setImg('heroImg', c.images && c.images.hero); iHero(document.getElementById('heroImg'), 'images.hero');
      var sg = document.getElementById('statsGrid');
      if (sg && c.hero.stats) {
        sg.innerHTML = '';
        c.hero.stats.forEach(function (s, si) {
          var d = el('div');
          var n = el('div', 'stat-num', s.num); tHero(n, 'hero.stats.' + si + '.num');
          var l = el('div', 'stat-label', s.label); tHero(l, 'hero.stats.' + si + '.label');
          d.appendChild(n); d.appendChild(l);
          sg.appendChild(d);
        });
      }
    }

    /* 模块区（动态） */
    var root = document.getElementById('modulesRoot');
    if (root) {
      root.innerHTML = '';
      usedAnchor = {};
      (c.modules || []).forEach(function (m, mi) {
        Edit.mi = mi;
        Edit.type = m.type;
        Edit.cfgKey = m.type + '_cfg';
        var fn = RENDERERS[m.type];
        if (!fn) return;
        var s = fn(m);
        if (s && anchorMap[m.type] && !usedAnchor[anchorMap[m.type]]) {
          s.id = anchorMap[m.type];
          usedAnchor[anchorMap[m.type]] = true;
        }
        if (s) root.appendChild(s);
      });
    }

    /* Footer（固定） */
    if (c.footer) {
      setText('footBrand', c.footer.brand); tHero(document.getElementById('footBrand'), 'footer.brand');
      setText('footRole', c.footer.role); tHero(document.getElementById('footRole'), 'footer.role');
      var mail = document.getElementById('footEmail');
      if (mail) {
        mail.textContent = '邮箱：' + (c.footer.email || '');
        if (c.footer.email) mail.href = 'mailto:' + c.footer.email;
        tHero(mail, 'footer.email');
      }
      setImg('wechatImg', c.images && c.images.wechat); iHero(document.getElementById('wechatImg'), 'images.wechat');
      var fn = document.getElementById('footNav');
      if (fn && c.footer.nav) {
        fn.innerHTML = '';
        c.footer.nav.forEach(function (n, ni) {
          var a = el('a', null, n.label || '');
          a.href = n.href || '#';
          tHero(a, 'footer.nav.' + ni + '.label');
          fn.appendChild(a);
        });
      }
    }
  }

  /* ---------- 内容加载 ---------- */
  function loadContent(cb) {
    if (/[?&]preview/.test(location.search)) {
      try {
        var p = localStorage.getItem(PREVIEW_KEY);
        if (p) { cb(JSON.parse(p)); return; }
      } catch (e) { /* ignore */ }
    }
    fetch('content.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(cb)
      .catch(function (err) { console.error('内容加载失败：', err); });
  }

  /* 暴露给 edit.html 的接口（前台所见即所得编辑器） */
  function enableEdit() { Edit.enabled = true; usedAnchor = {}; }
  function disableEdit() { Edit.enabled = false; usedAnchor = {}; }
  window.YC = {
    render: render,
    enableEdit: enableEdit,
    disableEdit: disableEdit,
    setText: setText,
    setImg: setImg,
    RENDERERS: RENDERERS,
    initInteractions: initInteractions,
    getByPath: function (o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); },
    setByPath: function (o, p, v) {
      var keys = p.split('.');
      var cur = o;
      for (var i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] == null) cur[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = v;
    }
  };

  if (/[?&]edit=/.test(location.search) || /edit\.html$/.test(location.pathname)) {
    /* 编辑模式：不自动渲染，由 editor.js 接管 */
  } else {
    loadContent(function (c) {
      content = c;
      render(c);
      initInteractions();
    });
  }

  /* ---------- 交互（在内容渲染后初始化） ---------- */
  function initInteractions() {
    var modal = document.getElementById('leadModal');
    var form = document.getElementById('leadForm');
    var successPanel = document.getElementById('modalSuccess');

    document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    });

    function openModal() {
      if (!modal) return;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      var firstInput = form && form.querySelector('#lf-name');
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 300);
    }
    function closeModal() {
      if (!modal) return;
      modal.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(function () {
        if (form) { form.reset(); form.style.display = ''; }
        if (successPanel) successPanel.style.display = 'none';
      }, 300);
    }

    var closeBtn = document.getElementById('modalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) closeModal();
    });
    var okBtn = document.getElementById('successOk');
    if (okBtn) okBtn.addEventListener('click', closeModal);

    /* 表单提交 */
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var submitBtn = document.getElementById('submitBtn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '提交中…'; }
        var formData = new FormData(form);
        fetch(form.action, { method: 'POST', body: formData })
          .then(function (res) {
            if (res.ok) { form.style.display = 'none'; if (successPanel) successPanel.style.display = ''; }
            else { return res.json().then(function (d) { throw new Error(d.message || '提交失败'); }); }
          })
          .catch(function (err) {
            alert('提交遇到问题，请稍后重试或直接扫码添加微信。\n\n' + err.message);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '提交预约'; }
          });
      });
    }

    /* 移动端菜单 */
    var menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', openModal);

    /* 锚点平滑滚动 */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length > 1) {
          var target = document.querySelector(id);
          if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
        }
      });
    });

    /* 入场动画（重新观察动态生成的 .reveal） */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (e) { io.observe(e); });

    /* 海报点击放大（灯箱） */
    document.querySelectorAll('.poster').forEach(function (p) {
      p.addEventListener('click', function () {
        var src = p.getAttribute('src');
        var box = document.createElement('div');
        box.style.cssText = 'position:fixed;inset:0;background:rgba(4,8,14,.92);z-index:999;' +
          'display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;';
        var img = document.createElement('img');
        img.src = src; img.style.cssText = 'max-width:92%;max-height:92%;border-radius:12px;box-shadow:0 30px 80px rgba(0,0,0,.6);';
        box.appendChild(img);
        box.addEventListener('click', function () { document.body.removeChild(box); });
        document.body.appendChild(box);
      });
    });
  }
})();
