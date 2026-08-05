/* 尹辰官网 — 交互脚本
   功能：从 content.json 渲染内容 + 平滑滚动/移动菜单/入场动画/微信复制/留资弹窗/海报灯箱
   管理后台：访问 /admin.html 编辑内容；带 ?preview=1 时优先读取 localStorage 预览 */
(function () {
  'use strict';

  var PREVIEW_KEY = 'yc_preview';
  var content = null;

  /* ---------- 小工具 ---------- */
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { var e = el(id); if (e && v != null) e.textContent = v; }
  function setImg(id, src) { var e = el(id); if (e && src) e.src = src; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  /* ---------- 渲染（数据 → DOM） ---------- */
  function render(c) {
    if (c.siteTitle) document.title = c.siteTitle;

    /* Hero */
    setText('heroKicker', c.hero.kicker);
    setText('heroTitle', c.hero.title);
    setText('heroSub', c.hero.sub);
    setImg('heroImg', c.images && c.images.hero);
    var sg = el('statsGrid');
    if (sg && c.hero.stats) {
      sg.innerHTML = '';
      c.hero.stats.forEach(function (s) {
        var d = document.createElement('div');
        var n = document.createElement('div'); n.className = 'stat-num'; n.textContent = s.num;
        var l = document.createElement('div'); l.className = 'stat-label'; l.textContent = s.label;
        d.appendChild(n); d.appendChild(l); sg.appendChild(d);
      });
    }

    /* Media */
    setText('mediaTitle', c.media.title);
    var mb = el('mediaBtns');
    if (mb && c.media.btns) {
      mb.innerHTML = '';
      c.media.btns.forEach(function (b) {
        var a = document.createElement('a');
        a.className = 'media-btn' + (b.alt ? ' alt' : '');
        a.href = b.href || '#'; a.target = '_blank'; a.rel = 'noopener';
        if (b.icon) { var ic = document.createElement('span'); ic.className = 'play-ic'; a.appendChild(ic); }
        a.appendChild(document.createTextNode(b.label || ''));
        mb.appendChild(a);
      });
    }

    /* About */
    setText('aboutHeading', c.about.heading);
    var ab = el('aboutBio');
    if (ab && c.about.bio) {
      ab.innerHTML = '';
      c.about.bio.forEach(function (t) {
        var p = document.createElement('p'); p.className = 'about-bio reveal'; p.textContent = t; ab.appendChild(p);
      });
    }
    setText('aboutCallout', c.about.callout);
    var ag = el('advGrid');
    if (ag && c.about.advCards) {
      ag.innerHTML = '';
      c.about.advCards.forEach(function (card) {
        var d = document.createElement('div'); d.className = 'adv-card reveal';
        var ic = document.createElement('div'); ic.className = 'adv-ic'; ic.textContent = card.ic || '';
        var h = document.createElement('h3'); h.textContent = card.title || '';
        var p = document.createElement('p'); p.textContent = card.desc || '';
        d.appendChild(ic); d.appendChild(h); d.appendChild(p); ag.appendChild(d);
      });
    }

    /* Courses */
    setText('coursesHeading', c.courses.heading);
    setText('coursesSub', c.courses.sub);
    var cg = el('courseGrid');
    if (cg && c.courses.list) {
      cg.innerHTML = '';
      c.courses.list.forEach(function (it) {
        var a = document.createElement('a'); a.className = 'course-card reveal'; a.href = '#contact';
        var h = document.createElement('h3'); h.textContent = it.title || '';
        var p = document.createElement('p'); p.textContent = it.desc || '';
        a.appendChild(h); a.appendChild(p); cg.appendChild(a);
      });
    }
    var tt = el('topicTags');
    if (tt && c.courses.topics) {
      tt.innerHTML = '';
      c.courses.topics.forEach(function (t) {
        var s = document.createElement('span'); s.className = 'tag'; s.textContent = t; tt.appendChild(s);
      });
    }
    setText('entTitle', c.courses.entBanner.title);
    setText('entDesc', c.courses.entBanner.desc);
    setText('entBtn', c.courses.entBanner.btn);

    /* System */
    setText('systemHeading', c.system.heading);
    setText('systemSub', c.system.sub);
    var sy = el('sysGrid');
    if (sy && c.system.cards) {
      sy.innerHTML = '';
      c.system.cards.forEach(function (card) {
        var d = document.createElement('div'); d.className = 'sys-card reveal';
        var ic = document.createElement('div'); ic.className = 'adv-ic'; ic.textContent = card.ic || '';
        var h = document.createElement('h3'); h.textContent = card.title || '';
        var p = document.createElement('p'); p.textContent = card.desc || '';
        d.appendChild(ic); d.appendChild(h); d.appendChild(p); sy.appendChild(d);
      });
    }

    /* Certs */
    setText('certsHeading', c.certs.heading);
    setText('certsSub', c.certs.sub);
    setText('certHl', c.certs.highlight);
    var cg2 = el('certGrid');
    if (cg2 && c.certs.list) {
      cg2.innerHTML = '';
      c.certs.list.forEach(function (t) {
        var s = document.createElement('span'); s.className = 'cert-chip';
        var dot = document.createElement('span'); dot.className = 'dot'; s.appendChild(dot);
        s.appendChild(document.createTextNode(t)); cg2.appendChild(s);
      });
    }

    /* Flagship */
    setText('flagHeading', c.flagship.heading);
    setText('flagText', c.flagship.text);
    setImg('flagImg', c.images && c.images.flagship);
    var dl = el('deliverList');
    if (dl && c.flagship.deliver) {
      dl.innerHTML = '';
      c.flagship.deliver.forEach(function (t) {
        var li = document.createElement('li');
        var ck = document.createElement('span'); ck.className = 'ck'; ck.textContent = '✓';
        li.appendChild(ck); li.appendChild(document.createTextNode(t)); dl.appendChild(li);
      });
    }

    /* Clients */
    setText('clientsHeading', c.clients.heading);
    setText('clientsSub', c.clients.sub);
    var ct = el('clientTags');
    if (ct && c.clients.tags) {
      ct.innerHTML = '';
      c.clients.tags.forEach(function (t) {
        var s = document.createElement('span'); s.className = 'client-tag'; s.textContent = t; ct.appendChild(s);
      });
    }
    // 客户案例区块已不放照片（统一在 sharing 区块展示）
    var tg = el('testiGrid');
    if (tg && c.clients.testi) {
      tg.innerHTML = '';
      c.clients.testi.forEach(function (t) {
        var d = document.createElement('div'); d.className = 'testi-card reveal';
        var p = document.createElement('p'); p.textContent = t.text || '';
        var w = document.createElement('div'); w.className = 'who'; w.textContent = t.who || '';
        d.appendChild(p); d.appendChild(w); tg.appendChild(d);
      });
    }

    /* Sharing - 每张海报独立配置（比例 / 焦点位置 / 占行宽度） */
    setText('sharingHeading', c.sharing.heading);
    var sh = el('shareGrid');
    if (sh && c.sharing.posters) {
      sh.className = 'share-grid reveal';
      sh.innerHTML = '';
      // 兜底：每张图的占行 grid-column span（每行 3 列）
      var spanMap = { full: 'span 3', half: 'span 2', third: 'span 1' };
      c.sharing.posters.forEach(function (item) {
        // 兼容老格式（字符串数组）与新格式（对象数组）
        var src, ratio, position, width, title;
        if (typeof item === 'string') {
          src = item;
          ratio = '760/1280';
          position = 'center';
          width = 'third';
          title = '';
        } else {
          src = item.poster || '';
          ratio = item.ratio || '760/1280';
          position = item.position || 'center';
          width = item.width || 'third';
          title = item.title || '';
        }
        var wrap = document.createElement('figure');
        wrap.className = 'poster-wrap poster-' + width;
        wrap.style.gridColumn = spanMap[width] || 'span 1';
        var img = document.createElement('img');
        img.className = 'poster';
        img.src = src;
        img.alt = title || '线上分享海报';
        img.style.aspectRatio = ratio.replace('/', ' / ');
        img.style.objectPosition = position;
        wrap.appendChild(img);
        if (title) {
          var cap = document.createElement('figcaption');
          cap.className = 'poster-caption';
          cap.textContent = title;
          wrap.appendChild(cap);
        }
        sh.appendChild(wrap);
      });
    }

    /* Final */
    setText('finalHeading', c.final.heading);
    setText('finalSub', c.final.sub);

    /* Footer */
    setText('footBrand', c.footer.brand);
    setText('footRole', c.footer.role);
    var mail = el('footEmail');
    if (mail) {
      mail.textContent = '邮箱：' + (c.footer.email || '');
      if (c.footer.email) mail.href = 'mailto:' + c.footer.email;
    }
    setImg('wechatImg', c.images && c.images.wechat);
    var fn = el('footNav');
    if (fn && c.footer.nav) {
      fn.innerHTML = '';
      c.footer.nav.forEach(function (n) {
        var a = document.createElement('a'); a.href = n.href || '#'; a.textContent = n.label || '';
        fn.appendChild(a);
      });
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
    var modal = el('leadModal');
    var form = el('leadForm');
    var successPanel = el('modalSuccess');

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

    var closeBtn = el('modalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) closeModal();
    });
    var okBtn = el('successOk');
    if (okBtn) okBtn.addEventListener('click', closeModal);

    /* 表单提交 */
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var submitBtn = el('submitBtn');
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
