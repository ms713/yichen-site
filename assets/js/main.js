/* 尹辰官网 — 交互脚本（模块化版）
   功能：从 content.json 渲染内容（hero + modules 数组 + footer）+ 平滑滚动/移动菜单/入场动画/微信复制/留资弹窗/海报灯箱
   管理后台：访问 /admin/ 编辑内容；带 ?preview=1 时优先读取 localStorage 预览 */
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
    (posters || []).forEach(function (item) {
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
      wrap.appendChild(img);
      if (title) wrap.appendChild(el('figcaption', 'poster-caption', title));
      container.appendChild(wrap);
    });
  }

  /* ---------- 模块分发器 ---------- */
  // 固定锚点：导航栏指向的第一个同类型模块
  var anchorMap = { about: 'about', courses: 'courses', certs: 'certs', gallery: 'sharing' };
  var usedAnchor = {};

  function modMedia(m) {
    var s = el('section', 'media');
    var w = el('div', 'wrap media-row');
    var left = el('div', 'media-left');
    left.appendChild(el('div', 'kicker', 'MEDIA & TALKS'));
    left.appendChild(el('div', 't', m.title || ''));
    var btns = el('div', 'media-btns');
    (m.btns || []).forEach(function (b) {
      var a = el('a', 'media-btn' + (b.alt ? ' alt' : ''));
      a.href = b.href || '#'; a.target = '_blank'; a.rel = 'noopener';
      if (b.icon) a.appendChild(el('span', 'play-ic'));
      a.appendChild(document.createTextNode(b.label || ''));
      btns.appendChild(a);
    });
    w.appendChild(left); w.appendChild(btns); s.appendChild(w);
    return s;
  }

  function modAbout(m) {
    var s = el('section', 'about');
    var w = el('div', 'wrap');
    var head = el('div', 'about-head reveal');
    head.appendChild(el('div', 'kicker', 'ABOUT'));
    head.appendChild(el('h2', 'h-sec', m.heading || ''));
    w.appendChild(head);
    var bio = el('div', 'about-bio');
    (m.bio || []).forEach(function (t) { bio.appendChild(el('p', 'about-bio reveal', t)); });
    w.appendChild(bio);
    if (m.callout) w.appendChild(el('div', 'callout reveal', m.callout));
    if (m.advCards) {
      var g = el('div', 'adv-grid');
      m.advCards.forEach(function (c) {
        var d = el('div', 'adv-card reveal');
        d.appendChild(el('div', 'adv-ic', c.ic || ''));
        d.appendChild(el('h3', null, c.title || ''));
        d.appendChild(el('p', null, c.desc || ''));
        g.appendChild(d);
      });
      w.appendChild(g);
    }
    s.appendChild(w);
    return s;
  }

  function modCourses(m) {
    var s = el('section', 'courses');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('h2', 'h-sec', m.heading || ''));
    top.appendChild(el('p', 'sub', m.sub || ''));
    w.appendChild(top);
    var g = el('div', 'course-grid');
    (m.list || []).forEach(function (it) {
      var a = el('a', 'course-card reveal');
      a.href = '#contact';
      a.appendChild(el('h3', null, it.title || ''));
      a.appendChild(el('p', null, it.desc || ''));
      g.appendChild(a);
    });
    w.appendChild(g);
    if (m.topics) {
      var tp = el('div', 'topics reveal');
      tp.appendChild(el('div', 'kicker', '近期热门授课主题'));
      var tt = el('div', 'topic-tags');
      m.topics.forEach(function (t) { tt.appendChild(el('span', 'tag', t)); });
      tp.appendChild(tt); w.appendChild(tp);
    }
    if (m.entBanner) {
      var eb = el('div', 'ent-banner reveal');
      var d = el('div');
      d.appendChild(el('h3', null, m.entBanner.title || ''));
      d.appendChild(el('p', null, m.entBanner.desc || ''));
      eb.appendChild(d);
      var b = el('a', 'btn', m.entBanner.btn || '');
      b.href = '#contact'; b.setAttribute('data-open-modal', '');
      eb.appendChild(b);
      w.appendChild(eb);
    }
    s.appendChild(w);
    return s;
  }

  function modSystem(m) {
    var s = el('section', 'system');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('div', 'kicker', m.kicker || 'SYSTEM DELIVERY'));
    top.appendChild(el('h2', 'h-sec', m.heading || ''));
    top.appendChild(el('p', 'sub', m.sub || ''));
    w.appendChild(top);
    var g = el('div', 'sys-grid');
    (m.cards || []).forEach(function (c) {
      var d = el('div', 'sys-card reveal');
      d.appendChild(el('div', 'adv-ic', c.ic || ''));
      d.appendChild(el('h3', null, c.title || ''));
      d.appendChild(el('p', null, c.desc || ''));
      g.appendChild(d);
    });
    w.appendChild(g);
    s.appendChild(w);
    return s;
  }

  function modCerts(m) {
    var s = el('section', 'certs');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('h2', 'h-sec', m.heading || ''));
    top.appendChild(el('p', 'sub', m.sub || ''));
    w.appendChild(top);
    if (m.highlight) w.appendChild(el('div', 'cert-hl reveal', m.highlight));
    var g = el('div', 'cert-grid reveal');
    (m.list || []).forEach(function (t) {
      var sp = el('span', 'cert-chip');
      sp.appendChild(el('span', 'dot'));
      sp.appendChild(document.createTextNode(t));
      g.appendChild(sp);
    });
    w.appendChild(g);
    s.appendChild(w);
    return s;
  }

  function modFlagship(m) {
    var s = el('section', 'flagship');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('div', 'kicker', m.kicker || 'FLAGSHIP CASE'));
    top.appendChild(el('h2', 'h-sec', m.heading || ''));
    w.appendChild(top);
    var fg = el('div', 'flag-grid');
    var left = el('div', 'reveal');
    left.appendChild(el('p', 'flag-text', m.text || ''));
    var dl = el('ul', 'deliver');
    (m.deliver || []).forEach(function (t) {
      var li = el('li');
      li.appendChild(el('span', 'ck', '✓'));
      li.appendChild(document.createTextNode(t));
      dl.appendChild(li);
    });
    left.appendChild(dl);
    fg.appendChild(left);
    if (m.image) {
      var img = el('img', 'flag-photo reveal');
      img.src = m.image;
      applyImg(img, m.ratio || '809/520', m.position || 'center');
      fg.appendChild(img);
    }
    w.appendChild(fg);
    s.appendChild(w);
    return s;
  }

  function modClients(m) {
    var s = el('section', 'clients');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('h2', 'h-sec', m.heading || ''));
    top.appendChild(el('p', 'sub', m.sub || ''));
    w.appendChild(top);
    if (m.tags) {
      var ct = el('div', 'client-tags reveal');
      m.tags.forEach(function (t) { ct.appendChild(el('span', 'client-tag', t)); });
      w.appendChild(ct);
    }
    var tg = el('div', 'testi');
    (m.testi || []).forEach(function (t) {
      var d = el('div', 'testi-card reveal');
      d.appendChild(el('p', null, t.text || ''));
      d.appendChild(el('div', 'who', t.who || ''));
      tg.appendChild(d);
    });
    w.appendChild(tg);
    s.appendChild(w);
    return s;
  }

  function modGallery(m) {
    var s = el('section', 'sharing');
    var w = el('div', 'wrap');
    var top = el('div', 'reveal');
    top.appendChild(el('div', 'kicker', m.kicker || 'SHARING & TALKS'));
    top.appendChild(el('h2', 'h-sec', m.heading || ''));
    w.appendChild(top);
    var g = el('div', 'share-grid reveal');
    renderGallery(g, m.posters);
    w.appendChild(g);
    s.appendChild(w);
    return s;
  }

  function modCta(m) {
    var s = el('section', 'final');
    var w = el('div', 'wrap reveal');
    w.appendChild(el('h2', null, m.heading || ''));
    w.appendChild(el('p', null, m.sub || ''));
    s.appendChild(w);
    return s;
  }

  function modRichtext(m) {
    var s = el('section', 'about');
    var w = el('div', 'wrap');
    var head = el('div', 'about-head reveal');
    head.appendChild(el('div', 'kicker', 'NOTE'));
    head.appendChild(el('h2', 'h-sec', m.heading || ''));
    w.appendChild(head);
    var bio = el('div', 'about-bio');
    (m.bio || []).forEach(function (t) { bio.appendChild(el('p', 'about-bio reveal', t)); });
    w.appendChild(bio);
    if (m.callout) w.appendChild(el('div', 'callout reveal', m.callout));
    s.appendChild(w);
    return s;
  }

  function modImage(m) {
    var s = el('section', 'about mod-image');
    var w = el('div', 'wrap');
    var fig = el('div', 'fig');
    var img = el('img', 'flag-photo');
    img.src = m.image || '';
    img.alt = m.caption || '图片';
    applyImg(img, m.ratio || '16/9', m.position || 'center');
    fig.appendChild(img);
    if (m.caption) fig.appendChild(el('p', 'poster-caption', m.caption));
    if (m.link) {
      var a = el('a');
      a.href = m.link; a.target = '_blank'; a.rel = 'noopener';
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
      setText('heroKicker', c.hero.kicker);
      setText('heroTitle', c.hero.title);
      setText('heroSub', c.hero.sub);
      setImg('heroImg', c.images && c.images.hero);
      var sg = document.getElementById('statsGrid');
      if (sg && c.hero.stats) {
        sg.innerHTML = '';
        c.hero.stats.forEach(function (s) {
          var d = el('div');
          d.appendChild(el('div', 'stat-num', s.num));
          d.appendChild(el('div', 'stat-label', s.label));
          sg.appendChild(d);
        });
      }
    }

    /* 模块区（动态） */
    var root = document.getElementById('modulesRoot');
    if (root) {
      root.innerHTML = '';
      (c.modules || []).forEach(function (m) {
        var s = renderModule(m);
        if (s) root.appendChild(s);
      });
    }

    /* Footer（固定） */
    if (c.footer) {
      setText('footBrand', c.footer.brand);
      setText('footRole', c.footer.role);
      var mail = document.getElementById('footEmail');
      if (mail) {
        mail.textContent = '邮箱：' + (c.footer.email || '');
        if (c.footer.email) mail.href = 'mailto:' + c.footer.email;
      }
      setImg('wechatImg', c.images && c.images.wechat);
      var fn = document.getElementById('footNav');
      if (fn && c.footer.nav) {
        fn.innerHTML = '';
        c.footer.nav.forEach(function (n) {
          var a = el('a', null, n.label || '');
          a.href = n.href || '#';
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

  loadContent(function (c) {
    content = c;
    render(c);
    initInteractions();
  });

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
