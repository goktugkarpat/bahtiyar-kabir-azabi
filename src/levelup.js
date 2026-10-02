/* KABİR AZABI — seviye atlama: tek, dramatik olay.
   Üç parça, hepsi bu dosyada:
     1. B.LevelUp.sound(ctx, dry, wet, t, k, noise)  WebAudio sentezi (örnek dosya yok). Alt bas darbesi, taş çatlağı, metalik titreşim kuyruğu
        (çan değil: uyumsuz, kaba kısmi sesler), yükselen hava, alçak koro gibi açık beşli, kısa alçak geçiren rüzgâr, kıvılcım çıtırtıları.
        audio.js H.levelUp bunu efekt kanalına bağlar; müzikten bağımsızdır. Yalnız ctx/dry/wet ister, bu yüzden OfflineAudioContext ile de sınanır.
     2. B.LevelUp.create(opts)  ekran katmanı: afiş (SEVİYE ATLADIN), kenar parlaması / renk sapması (post.setAbilityFx), kamera itişi, kısa zaman yavaşlaması.
        app.js progression olayı B.LevelUp.trigger(...) çağırır; her kare B.LevelUp.step(dt) ve B.LevelUp.push() / timeScale() okunur.
     3. B.LevelUp.createWorld(opts)  dünya efekti (effects.js içinde kurulur): kıvılcım sarmalı, üç rün halkası, ince ışık sütunu, yükselen közler.
   Sıfır dinamik ışık, sıfır çalışma zamanı materyal/geometri üretimi (hepsi kurulumda ve ısınmada), kare başına ayırma yok. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // =================================================================== 1. SES
  const noiseCache = new WeakMap();
  function noiseBuffers(ctx) {
    let n = noiseCache.get(ctx);
    if (n) return n;
    const len = Math.floor(ctx.sampleRate * 3), white = ctx.createBuffer(1, len, ctx.sampleRate), pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = white.getChannelData(0), p = pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, seed = 1234567;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const r = seed / 4294967296 * 2 - 1;
      w[i] = r * .7; b0 = .99765 * b0 + r * .099046; b1 = .963 * b1 + r * .2965164; b2 = .57 * b2 + r * 1.0526913; p[i] = (b0 + b1 + b2 + r * .1848) * .18;
    }
    noiseCache.set(ctx, n = { white, pink }); return n;
  }
  /* dry: efekt kanalı, wet: yankı kanalı (boş olabilir), t: başlangıç, k: ses çarpanı. Dönüş: toplam süre (sn). */
  function sound(ctx, dry, wet, t, k, noise) {
    k = k == null ? 1 : k;
    const nb = noise && noise.white && noise.pink ? noise : noiseBuffers(ctx), all = [], srcs = [];
    const reg = n => { all.push(n); return n; };
    const gain = (v, to) => { const g = reg(ctx.createGain()); g.gain.value = v; if (to) g.connect(to); return g; };
    const filt = (type, f, q, to) => { const b = reg(ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (to) b.connect(to); return b; };
    const pan = (p, to) => { if (!ctx.createStereoPanner) return gain(1, to); const s = reg(ctx.createStereoPanner()); s.pan.value = p; if (to) s.connect(to); return s; };
    const osc = (type, f, t0, t1, to) => { const o = reg(ctx.createOscillator()); o.type = type; o.frequency.value = f; o.connect(to); o.start(t0); o.stop(t1); srcs.push(o); return o; };
    const noiseSrc = (buf, t0, t1, to, off) => { const s = reg(ctx.createBufferSource()); s.buffer = buf; s.loop = true; s.connect(to); s.start(t0, off || 0); s.stop(t1); srcs.push(s); return s; };
    const env = (g, t0, peak, a, hold, rel) => {   // hızlı vuruş, kısa tutuş, üstel sönüm
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); if (hold > 0) g.gain.setValueAtTime(peak, t0 + a + hold);
      g.gain.setTargetAtTime(0, t0 + a + hold, rel / 3.2);
    };
    // çıkış zinciri: 28 Hz üstü + yumuşak sıkıştırıcı; yankıya alt bas gitmez
    const hp = filt('highpass', 28, .6), comp = reg(ctx.createDynamicsCompressor());
    comp.threshold.value = -15; comp.knee.value = 10; comp.ratio.value = 3.2; comp.attack.value = .003; comp.release.value = .3;
    const top = gain(1, comp); hp.connect(top); comp.connect(dry);
    const air = gain(1);                      // alt bas dışındaki her şey
    const send = wet ? gain(.34 * 1, wet) : null; if (send) air.connect(send);
    air.connect(hp);
    const sub = gain(1, hp);                  // alt bas doğrudan, yankısız

    // ---- 1. Alt bas darbesi: sinüs, perdesi aşağı iner (95 -> 44 Hz), hafif doygunluk ile 100-200 Hz'de de duyulur
    {
      const g = gain(0), ws = reg(ctx.createWaveShaper()), c = new Float32Array(513); for (let i = 0; i < 513; i++) { const x = i / 256 - 1; c[i] = Math.tanh(x * 2.1) / Math.tanh(2.1); }
      ws.curve = c; ws.oversample = '2x'; const lp = filt('lowpass', 520, .7);
      const o = osc('sine', 96, t, t + 2.2, g); o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(46, t + .24); o.frequency.exponentialRampToValueAtTime(37, t + 1.6);
      g.connect(ws); ws.connect(lp); lp.connect(sub);
      env(g, t, .68 * k, .004, .05, 1.0);
      const g2 = gain(0, sub), o2 = osc('sine', 150, t, t + .6, g2); o2.frequency.setValueAtTime(150, t); o2.frequency.exponentialRampToValueAtTime(70, t + .16); env(g2, t, .27 * k, .003, 0, .2);
    }
    // ---- 2. Taş çatlağı: kısa gürültü + keskin bir üst tık
    {
      const g = gain(0, air), bp = filt('bandpass', 1100, .7, g); noiseSrc(nb.white, t, t + .2, bp, .3); env(g, t, .34 * k, .002, .004, .055);
      const g2 = gain(0, air), hp2 = filt('highpass', 2600, .7, g2); noiseSrc(nb.white, t, t + .1, hp2, 1.1); env(g2, t, .15 * k, .001, 0, .03);
    }
    // ---- 3. Metalik kuyruk: uyumsuz kısmi sesler, çiftler hafif ayarsız (vuruşma), 41 Hz kaba genlik titreşimi. Çan oranları (2.76, 5.4, 8.93) kullanılmaz.
    {
      const ring = gain(.62), hp3 = filt('highpass', 380, .6, pan(0, air)); ring.connect(hp3);
      const depth = gain(.3); depth.connect(ring.gain); osc('sine', 41, t, t + 1.6, depth);
      const base = 233, ratios = [1, 1.47, 2.09, 2.56, 3.18, 4.07, 5.12];
      ratios.forEach((r, i) => {
        const dec = .62 / (1 + i * .42), a = .078 / (1 + i * .45);
        for (const d of [1, 1.0046]) { const g = gain(0, ring), o = osc(i % 3 === 2 ? 'triangle' : 'sine', base * r * d, t, t + dec + .3, g); env(g, t + .002 * i, a * k, .002, 0, dec); }
      });
    }
    // ---- 4. Yükselen hava: iki yana açılan pembe gürültü, bant 180 -> 2600 Hz, ~1.2 sn'de doruğa çıkar
    {
      for (const side of [-1, 1]) {
        const g = gain(.0001), bp = filt('bandpass', 180, 1.0), p = pan(side * .5, air); bp.connect(g); g.connect(p);
        bp.frequency.setValueAtTime(180, t + .03); bp.frequency.exponentialRampToValueAtTime(2600, t + 1.25); bp.frequency.exponentialRampToValueAtTime(900, t + 2.1);
        g.gain.setValueAtTime(.0001, t + .03); g.gain.exponentialRampToValueAtTime(.21 * k, t + 1.15); g.gain.exponentialRampToValueAtTime(.0001, t + 2.1);
        noiseSrc(nb.pink, t + .03, t + 2.2, bp, side > 0 ? 1.3 : .2);
      }
    }
    // ---- 5. Koro benzeri alçak ses: A1-E2-A2-E3 açık beşli, her ses ikişer hafif ayarsız testere; ünlü süzgeçleri "o" -> "a" açılır; melodi yok
    {
      const padIn = gain(1), body = filt('lowpass', 260, .6), f1 = filt('bandpass', 430, 3.4), f2 = filt('bandpass', 880, 5), f3 = filt('bandpass', 2400, 7), mix = gain(1), lp = filt('lowpass', 2800, .5);
      const out = gain(0); padIn.connect(body); padIn.connect(f1); padIn.connect(f2); padIn.connect(f3);
      body.connect(gain(.9, mix)); f1.connect(gain(1.5, mix)); f2.connect(gain(1.0, mix)); f3.connect(gain(.32, mix)); mix.connect(lp); lp.connect(out); out.connect(pan(0, air));
      f1.frequency.setValueAtTime(430, t); f1.frequency.linearRampToValueAtTime(690, t + 1.3); f2.frequency.setValueAtTime(880, t); f2.frequency.linearRampToValueAtTime(1080, t + 1.3);
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.21 * k, t + .55); out.gain.setValueAtTime(.21 * k, t + 1.5); out.gain.setTargetAtTime(0, t + 1.5, .38);
      const vg = gain(7); osc('sine', 5.1, t, t + 3.7, vg);   // 7 sent titreme, tüm seslere aynı kaynaktan
      [55, 82.41, 110, 164.81].forEach((f, i) => {
        for (const d of [-8, 8]) { const g = gain(i === 3 ? .5 : i === 0 ? 1.1 : .8, padIn), o = osc('sawtooth', f, t, t + 3.7, g); o.detune.value = d; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.02, t + 1.6); vg.connect(o.detune); }
      });
    }
    // ---- 6. Kısa, alçak geçiren rüzgâr: yükselen sütunun hava itmesi
    {
      const g = gain(.0001), lp = filt('lowpass', 140, .8, g); g.connect(pan(0, air));
      lp.frequency.setValueAtTime(140, t); lp.frequency.exponentialRampToValueAtTime(1900, t + .3); lp.frequency.exponentialRampToValueAtTime(260, t + .95);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5 * k, t + .26); g.gain.exponentialRampToValueAtTime(.0001, t + .95);
      noiseSrc(nb.white, t, t + 1, lp, .7);
    }
    // ---- 7. Kıvılcım çıtırtıları: sarmalın kıvılcımlarıyla aynı anlarda
    {
      let seed = 99;
      for (let i = 0; i < 9; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const r1 = seed / 4294967296; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const r2 = seed / 4294967296;
        const at = t + .22 + i * .13 + r1 * .08, g = gain(0), hp4 = filt('highpass', 2800 + r2 * 2400, .8, g); g.connect(pan((r2 - .5) * 1.4, air));
        noiseSrc(nb.white, at, at + .06, hp4, r1 * 2); env(g, at, (.05 + .05 * r2) * k, .001, 0, .025 + r1 * .03);
      }
    }
    // ---- temizlik: son kaynak bitince tüm düğümleri bırak
    let ended = 0; const end = srcs.length;
    for (const s of srcs) s.onended = () => { if (++ended === end) for (const n of all) try { n.disconnect(); } catch (e) {} };
    return 3.7;
  }

  // =================================================================== 2. EKRAN KATMANI
  // prefers-reduced-motion (or ?lvcalm for QA): simple fade, no time dilation, camera push, fringe, ring refraction or moving sparks
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }, qaCalm = typeof location !== 'undefined' && /[?&]lvcalm(&|$)/.test(location.search), reduced = { get matches() { return qaCalm || mq.matches; } };
  const TITLE = 'SEVİYE ATLADIN', TOTAL = 2.7;
  const CSS = `
body:has(#lu-banner.lu-on) #announcement{opacity:0!important}   /* the arena / room announcement waits while the level-up banner owns the middle of the screen */
#lu-banner{position:absolute;left:50%;top:14%;width:min(980px,94vw);transform:translateX(-50%);text-align:center;pointer-events:none;opacity:0;z-index:6;contain:layout style}
#lu-banner::before{content:'';position:absolute;left:-8%;right:-8%;top:-42%;bottom:-30%;z-index:-1;background:radial-gradient(ellipse 50% 50% at 50% 50%,#050101d0 0%,#0a0302a0 38%,#05010150 62%,transparent 100%)}
#lu-banner .lu-flare{position:absolute;left:4%;right:4%;top:calc(var(--k,1)*38px);height:30px;margin-top:-14px;background:radial-gradient(ellipse 50% 50% at 50% 50%,#ffe2a4 0%,#ff6a2a99 12%,#c0200c44 40%,transparent 72%);transform:scaleX(0);opacity:0;z-index:-1}
#lu-banner .lu-title{position:relative;display:block;margin:0;white-space:nowrap;font:800 calc(var(--k,1)*clamp(30px,4.5vw,70px))/1.05 var(--text,'Source Sans 3',system-ui,sans-serif);letter-spacing:.15em;text-indent:.15em;text-transform:uppercase}
#lu-banner .lu-title i{display:inline-block;font-style:normal;color:#f4cd86;text-shadow:0 3px 0 #000,0 0 10px #000c,0 0 24px #d4401c99}
#lu-banner .lu-title i.sp{width:.42em}
#lu-banner .lu-rule{display:block;position:relative;width:calc(var(--k,1)*min(620px,76vw));height:calc(var(--k,1)*18px);margin:calc(var(--k,1)*8px) auto calc(var(--k,1)*4px);transform:scaleX(0);transform-origin:50% 50%}
#lu-banner .lu-rule::before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:linear-gradient(90deg,transparent,#c88a4a99 14%,#f4cf8e 50%,#c88a4a99 86%,transparent)}
#lu-banner .lu-rule::after{content:'';position:absolute;left:50%;top:50%;width:calc(var(--k,1)*10px);height:calc(var(--k,1)*10px);margin:calc(var(--k,1)*-5px) 0 0 calc(var(--k,1)*-5px);transform:rotate(45deg);background:#e9b266;box-shadow:0 0 12px 2px #ff7a30aa,0 0 0 3px #1a0805,0 0 0 4px #c88a4a}
#lu-banner .lu-lv{display:flex;align-items:baseline;justify-content:center;gap:calc(var(--k,1)*16px);margin-top:calc(var(--k,1)*2px)}
#lu-banner .lu-lv em{font:700 calc(var(--k,1)*clamp(15px,1.7vw,26px))/1 var(--text,system-ui,sans-serif);font-style:normal;letter-spacing:.42em;text-indent:.42em;color:#dccaa6;text-shadow:0 2px 3px #000,0 0 14px #000}
#lu-banner .lu-num{position:relative;display:inline-block;min-width:1.1ch;font:800 calc(var(--k,1)*clamp(44px,5.8vw,92px))/1 var(--text,system-ui,sans-serif);color:#f6dfa6}
#lu-banner .lu-num s,#lu-banner .lu-num u{display:block;text-decoration:none;color:#f8dc9a;text-shadow:0 3px 0 #000,0 0 12px #ff5a22cc,0 0 28px #b3200c99}
#lu-banner .lu-num s{position:absolute;left:0;right:0;top:0;opacity:0}
#lu-banner .lu-note{margin:calc(var(--k,1)*6px) 0 0;font:700 calc(var(--k,1)*clamp(14px,1.5vw,24px))/1.35 var(--text,system-ui,sans-serif);letter-spacing:.2em;text-indent:.2em;text-transform:uppercase;color:#e9d9bd;text-shadow:0 2px 3px #000,0 0 16px #000;opacity:0}
#lu-banner .lu-note b{color:#ffcf86;font-weight:800}
#lu-banner .lu-skill{margin:calc(var(--k,1)*3px) 0 0;font:700 calc(var(--k,1)*clamp(14px,1.5vw,24px))/1.35 var(--text,system-ui,sans-serif);letter-spacing:.2em;text-indent:.2em;text-transform:uppercase;color:#ff9a62;text-shadow:0 2px 3px #000,0 0 16px #6a1408;opacity:0}
#lu-banner .lu-skill:empty,#lu-banner .lu-note:empty{display:none}
#lu-banner.lu-on{animation:lu-life ${TOTAL}s linear both}
#lu-banner.lu-on .lu-title{animation:lu-drift ${TOTAL}s cubic-bezier(.2,.7,.3,1) both}
#lu-banner.lu-on .lu-title i{animation:lu-letter .62s cubic-bezier(.12,.8,.22,1) both;animation-delay:calc(.1s + var(--n,0)*.034s)}
#lu-banner.lu-on .lu-flare{animation:lu-flare 1.05s cubic-bezier(.2,.7,.2,1) both}
#lu-banner.lu-on .lu-rule{animation:lu-rule .7s .42s cubic-bezier(.2,.8,.2,1) both}
#lu-banner.lu-on .lu-lv em{animation:lu-rise .6s .64s both}
#lu-banner.lu-on .lu-num u{animation:lu-num .8s .72s cubic-bezier(.16,1.3,.3,1) both}
#lu-banner.lu-on .lu-num s{animation:lu-numold .5s .62s both}
#lu-banner.lu-on .lu-note{animation:lu-rise .7s 1.0s both}
#lu-banner.lu-on .lu-skill{animation:lu-rise .7s 1.22s both}
@keyframes lu-life{0%{opacity:0}4%{opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes lu-drift{from{transform:scale(1.07)}to{transform:scale(1)}}
@keyframes lu-letter{0%{opacity:0;transform:translateY(-.32em) scale(1.75)}45%{opacity:1}100%{opacity:1;transform:none}}
@keyframes lu-flare{0%{opacity:1;transform:scaleX(.05)}30%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1.08)}}
@keyframes lu-rule{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes lu-rise{from{opacity:0;transform:translateY(.55em)}to{opacity:1;transform:none}}
@keyframes lu-num{0%{opacity:0;transform:translateY(.5em) scale(2.1)}100%{opacity:1;transform:none}}
@keyframes lu-numold{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-.5em) scale(.8)}}
#lu-banner.lu-calm.lu-on{animation:lu-calmlife ${TOTAL}s linear both}
#lu-banner.lu-calm .lu-title,#lu-banner.lu-calm .lu-title i,#lu-banner.lu-calm .lu-flare,#lu-banner.lu-calm .lu-rule,#lu-banner.lu-calm .lu-lv em,#lu-banner.lu-calm .lu-num u,#lu-banner.lu-calm .lu-num s,#lu-banner.lu-calm .lu-note,#lu-banner.lu-calm .lu-skill{animation:none!important}
#lu-banner.lu-calm .lu-rule{transform:none}#lu-banner.lu-calm .lu-lv em,#lu-banner.lu-calm .lu-num u,#lu-banner.lu-calm .lu-note,#lu-banner.lu-calm .lu-skill{opacity:1}
@keyframes lu-calmlife{0%{opacity:0}14%{opacity:1}78%{opacity:1}100%{opacity:0}}
#lu-banner.lu-paint{opacity:1;animation:none!important}#lu-banner.lu-paint *{animation:none!important;opacity:1!important;transform:none!important}#lu-banner.lu-paint .lu-rule{transform:none!important}#lu-banner.lu-paint .lu-num s{opacity:0!important}
`;
  let el = null, elTitle = null, elOld = null, elNew = null, elNote = null, elSkill = null;
  function ensureDom() {
    if (el || typeof document === 'undefined' || !document.body) return el;
    const st = document.createElement('style'); st.id = 'lu-style'; st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'lu-banner'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<i class="lu-flare" aria-hidden="true"></i><h2 class="lu-title"></h2><i class="lu-rule" aria-hidden="true"></i>' +
      '<div class="lu-lv"><em>SEVİYE</em><b class="lu-num"><s></s><u></u></b></div><p class="lu-note"></p><p class="lu-skill"></p>';
    elTitle = el.querySelector('.lu-title'); elOld = el.querySelector('.lu-num s'); elNew = el.querySelector('.lu-num u'); elNote = el.querySelector('.lu-note'); elSkill = el.querySelector('.lu-skill');
    fillTitle(elTitle);
    const host = document.getElementById('hud') || document.body; host.appendChild(el);
    return el;
  }
  // The headline: one <i> per letter (staggered reveal). Solid warm gold with small text shadows: no CSS filter, no background-clip, no large blurs (first-use raster cost).
  function fillTitle(title) {
    title.textContent = '';
    for (let i = 0; i < TITLE.length; i++) { const c = document.createElement('i'); c.style.setProperty('--n', String(i)); if (TITLE[i] === ' ') c.className = 'sp'; c.textContent = TITLE[i] === ' ' ? ' ' : TITLE[i]; title.appendChild(c); }
  }
  const S = { on: false, t: 99, calm: false, level: 1, old: 1, hx: 0, hz: 0 };
  const FX = { spin: 0, spinAt: { x: 0, z: 0 }, chroma: 0, flash: 0, sat: 0, vig: 0, ring: { x: 0, z: 0, r: 1, w: .6, t: 0 } };
  const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  function skillsGained(from, to) {
    const P = B.Progression, list = P && P.skills ? P.skills : [], out = [];
    for (const s of list) if (s.level > from && s.level <= to) out.push(s.name);
    return out;
  }
  /* d: progression olayı {level, levels, points}, hero: game.player */
  function trigger(d, hero) {
    if (!ensureDom()) return;
    d = d || {}; const level = d.level | 0 || 2, levels = Math.max(1, d.levels | 0 || 1), old = Math.max(1, level - levels);
    S.on = true; S.t = 0; S.calm = !!reduced.matches; S.level = level; S.old = old; S.hx = hero ? hero.x : 0; S.hz = hero ? hero.z : 0;
    elOld.textContent = String(old); elNew.textContent = String(level); 
    const pts = d.points | 0;
    elNote.innerHTML = '+' + levels + ' YETENEK PUANI' + (pts > levels ? ' (<b>' + pts + '</b>)' : '') + ' · <b>T</b>';
    const sk = skillsGained(old, level);
    elSkill.textContent = sk.length ? (sk.length > 1 ? 'YENİ YETENEKLER: ' : 'YENİ YETENEK: ') + sk.join(' · ') : '';
    el.classList.toggle('lu-calm', S.calm);
    el.classList.remove('lu-on', 'lu-paint'); void el.offsetWidth; el.classList.add('lu-on');
  }
  function cancel() { S.on = false; S.t = 99; if (el) el.classList.remove('lu-on', 'lu-paint'); }
  /* Her kare, gerçek dt ile (app.js frameStep). Kapalıyken maliyeti sıfıra yakındır. */
  function step(dt) {
    if (!S.on) return;
    const t = S.t += dt, app = B.app, post = app && app.post, p = app && app.game && app.game.player;
    if (p) { S.hx = p.x; S.hz = p.z; }
    if (t > TOTAL) { S.on = false; if (el) el.classList.remove('lu-on'); return; }
    if (post && post.setAbilityFx && t < 1.4) {
      const calm = S.calm;
      FX.flash = .46 * Math.exp(-t * 8.5) * clamp(t / .012, 0, 1);
      FX.vig = .72 * clamp(t / .04, 0, 1) * Math.exp(-Math.max(0, t - .04) * 7.5);
      FX.chroma = calm ? 0 : .3 * Math.exp(-t * 5.2);
      FX.sat = .28 * Math.exp(-t * 3);
      FX.spin = calm || t > .4 ? 0 : .3 * Math.exp(-t * 9);
      FX.spinAt.x = S.hx; FX.spinAt.z = S.hz;
      const k = t / .9;
      if (!calm && k < 1) { FX.ring.x = S.hx; FX.ring.z = S.hz; FX.ring.r = 1.2 + 10 * ease(k); FX.ring.w = .75 * (.7 + .9 * k); FX.ring.t = k; post.setAbilityFx(FX); }
      else { const ring = FX.ring; FX.ring = null; post.setAbilityFx(FX); FX.ring = ring; }
    }
  }
  /* kamera yaklaşması (oran, 0..~0.028): app.js cameraStep `near` çarpanından çıkarılır */
  function push() { if (!S.on || S.calm) return 0; const t = S.t; return .028 * (1 - Math.exp(-t * 28)) * Math.exp(-Math.max(0, t - .12) * 2.7); }
  /* saf görsel yavaşlama: ilk ~170 ms 0.4x (benzetim dt'sini app.js çarpar); azaltılmış harekette 1 */
  function timeScale() { if (!S.on || S.calm) return 1; const t = S.t; return t >= .17 ? 1 : t < .07 ? .4 : .4 + .6 * (t - .07) / .1; }
  // Isınma: yükleme perdesi altında afişi bir kez tam durumda boyatmak için (warmup.js richState)
  function paintState(node) {
    const root = node || ensureDom(); if (!root) return;
    const q = s => root.querySelector(s);
    const title = q('.lu-title'); if (title && !title.children.length) fillTitle(title);
    const o = q('.lu-num s'), n = q('.lu-num u'), no = q('.lu-note'), sk = q('.lu-skill');
    if (o) o.textContent = '11'; if (n) n.textContent = '12'; if (no) no.innerHTML = '+1 YETENEK PUANI · <b>T</b>'; if (sk) sk.textContent = 'YENİ YETENEK: Kıyamet Narası';
    root.classList.add('lu-paint');
  }

  // =================================================================== 3. DÜNYA EFEKTİ (effects.js kurar)
  const GLSL_COMMON = `
const float PI=3.14159265;
float hash1(float n){return fract(sin(n*127.1+31.7)*43758.5453);}
float seg(vec2 p,vec2 a,vec2 b,float w){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return 1.-smoothstep(w*.4,w,length(pa-ba*h));}
float rune(vec2 p,float id){
  float h1=hash1(id),h2=hash1(id+7.3),h3=hash1(id+19.1);
  float s=seg(p,vec2(0.,-.86),vec2(0.,.86),.15);
  if(h1>.3)s=max(s,seg(p,vec2(0.,.86*(h2*2.-1.)),vec2(.62,.86*(h3*2.-1.)+.34),.14));
  if(h2>.42)s=max(s,seg(p,vec2(0.,-.1-.5*h3),vec2(-.62,.5*h1),.14));
  if(h3>.58)s=max(s,seg(p,vec2(-.56,.72),vec2(.56,.72),.13));
  if(h1<.22)s=max(s,seg(p,vec2(-.52,-.42),vec2(.52,.22),.13));
  if(h2<.2)s=max(s,seg(p,vec2(-.5,.1),vec2(.5,.1),.13));
  return s;
}`;
  const PLANE_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const RINGS_FS = `varying vec2 vUv;uniform float uT,uCalm;${GLSL_COMMON}
void main(){
  vec2 p=(vUv-.5)*20.;float r=length(p);if(r>9.9)discard;float a=atan(p.x,p.y);vec3 col=vec3(0.);
  for(int i=0;i<3;i++){
    float fi=float(i);float age=uT-(.03+.17*fi);if(age<0.)continue;
    float dur=.85+.17*fi,k=clamp(age/dur,0.,1.),R=3.2+2.4*fi;
    float rad=uCalm>.5?R*.6:mix(.45,R,1.-pow(1.-k,3.));
    float life=smoothstep(0.,.05,age)*pow(1.-k,1.1);
    float w=.05+.035*k,dd=r-rad;
    float core=exp(-dd*dd/(w*w)),halo=exp(-dd*dd/(w*w*20.))*.34;
    float bw=.3+.09*fi,bv=(rad-r-.07)/bw;
    float band=step(0.,bv)*step(bv,1.)*smoothstep(0.,.1,bv)*(1.-smoothstep(.9,1.,bv));
    float N=20.+9.*fi,ca=(a/(2.*PI)+.5+(fi<1.5?1.:-1.)*age*.05)*N;
    float rn=rune(vec2(fract(ca)*2.-1.,bv*2.-1.),floor(ca)+fi*57.);
    col+=(vec3(5.4,2.6,.8)*core+vec3(2.8,.07,.03)*halo+vec3(4.,1.4,.38)*band*(.07+.93*rn))*life;
  }
  if(max(col.r,max(col.g,col.b))<.004)discard;
  gl_FragColor=vec4(col,1.);
}`;
  const SIGIL_FS = `varying vec2 vUv;uniform float uT,uCalm;${GLSL_COMMON}
void main(){
  vec2 p=(vUv-.5)*5.2;float r=length(p);if(r>2.55)discard;float a=atan(p.x,p.y),t=uT;
  float L=smoothstep(0.,.16,t)*(1.-smoothstep(1.15,2.05,t));
  float pul=uCalm>.5?1.:1.+.025*sin(t*10.);
  float R1=1.95*pul,R2=1.6*pul,R3=.72;
  float c1=exp(-pow((r-R1)/.036,2.)),c2=exp(-pow((r-R2)/.026,2.))*.8,c3=exp(-pow((r-R3)/.022,2.))*.6;
  float bv=(r-R2-.035)/(R1-R2-.07);
  float band=step(0.,bv)*step(bv,1.)*smoothstep(0.,.12,bv)*(1.-smoothstep(.88,1.,bv));
  float spin=uCalm>.5?0.:t*.07;
  float ca=(a/(2.*PI)+.5+spin)*26.;
  float rn=rune(vec2(fract(ca)*2.-1.,bv*2.-1.),floor(ca)+3.);
  float spokes=pow(max(0.,cos((a+(uCalm>.5?0.:t*.4))*6.)),22.)*smoothstep(R3,R3+.12,r)*(1.-smoothstep(R2-.14,R2-.03,r))*.8;
  float halo=exp(-pow((r-R1)/.26,2.))*.2;
  float pool=exp(-r*r/.32)*smoothstep(0.,.05,t)*(1.-smoothstep(.2,1.1,t))*.5;
  vec3 col=(vec3(5.8,2.7,.8)*(c1+c2+c3)+vec3(3.,.12,.04)*halo+vec3(4.2,1.4,.38)*band*(.07+.93*rn)+vec3(3.4,.5,.11)*spokes)*L+vec3(3.4,1.,.24)*pool;
  if(max(col.r,max(col.g,col.b))<.004)discard;
  gl_FragColor=vec4(col,1.);
}`;
  const BEAM_VS = `varying vec3 vN,vV;varying float vY;varying vec2 vUv;void main(){vUv=uv;vY=uv.y;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
  const BEAM_FS = `varying vec3 vN,vV;varying float vY;varying vec2 vUv;uniform float uT,uCalm;
void main(){
  float ndv=abs(dot(normalize(vN),normalize(vV)));float soft=pow(ndv,1.25);
  float top=uCalm>.5?1.:clamp(uT/.15,0.,1.);float grow=1.-smoothstep(top-.06,top+.001,vY);
  float env=smoothstep(0.,.05,uT)*(1.-smoothstep(.4,1.5,uT));
  float st=.5+.5*sin(vUv.x*6.2832*6.+vY*7.-uT*(uCalm>.5?0.:6.)),st2=.5+.5*sin(vUv.x*6.2832*11.-vY*5.+uT*(uCalm>.5?0.:4.));
  float streak=.3+.7*st*st2;
  float hf=pow(1.-vY,1.35)*smoothstep(0.,.025,vY);
  float al=soft*hf*env*grow*streak*.62;
  vec3 col=mix(vec3(2.8,.14,.05),vec3(6.,3.2,1.1),soft*soft);
  col*=al;if(max(col.r,max(col.g,col.b))<.004)discard;
  gl_FragColor=vec4(col,1.);
}`;
  const SHELL_FS = `varying vec3 vN,vV;varying float vY;varying vec2 vUv;uniform float uT,uCalm;
void main(){
  float ndv=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.-ndv,2.4);
  float ym=vY*2.5;vec3 col=vec3(0.);
  col+=vec3(4.2,1.15,.26)*pow(rim,2.2)*exp(-uT*3.2)*smoothstep(0.,.03,uT)*.5*(1.-smoothstep(.1,.9,vY));
  if(uCalm<.5){
    for(int i=0;i<3;i++){float yc=(uT-.02-.15*float(i))*3.1;float c=exp(-pow((ym-yc)/.055,2.))*smoothstep(0.,.12,yc)*(1.-smoothstep(1.9,2.6,yc));
      float jew=.35+.65*pow(max(0.,cos(vUv.x*6.2832*12.+uT*3.)),10.);
      col+=mix(vec3(4.4,2.2,.55),vec3(6.5,5.,3.),c)*c*jew;}
  }
  if(max(col.r,max(col.g,col.b))<.004)discard;
  gl_FragColor=vec4(col,1.);
}`;
  const PTS_VS = `attribute vec4 aA,aB;uniform float uT,uScale,uCalm;uniform vec3 uHero,uOrigin;varying vec3 vC;varying float vAlpha;
void main(){
  float kind=aB.x,size=aB.y,seed=aB.z,life=aB.w;float age=uT-aA.w;float k=age/life;
  if(age<0.||k>=1.||(uCalm>.5&&kind<2.5)){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vAlpha=0.;vC=vec3(0.);return;}
  vec3 p;vec3 col;float al;
  if(kind<.5){
    float h=age*aA.z;float ang=aA.x+age*5.2+h*.3;float r=aA.y*(1.-.4*k)+.1*sin(age*9.+seed*30.);
    p=uHero+vec3(sin(ang)*r,.05+h,cos(ang)*r);
    col=mix(vec3(7.5,4.4,1.5),vec3(3.4,.22,.05),smoothstep(.12,1.,k));
    al=smoothstep(0.,.07,k)*pow(1.-k,1.35);
  }else if(kind<1.5){
    p=uOrigin+vec3(sin(aA.x)*aA.y,.1+age*aA.z,cos(aA.x)*aA.y);
    p.x+=sin(age*2.3+seed*40.)*.22;p.z+=cos(age*1.9+seed*33.)*.22;
    col=seed>.5?vec3(3.6,1.7,.5):vec3(2.8,.2,.07);
    al=smoothstep(0.,.18,k)*(1.-smoothstep(.55,1.,k))*(.72+.28*sin(age*14.+seed*50.));
  }else{
    vec3 dir=vec3(sin(aA.x)*cos(aA.y),sin(aA.y),cos(aA.x)*cos(aA.y));
    p=uOrigin+vec3(0.,.9,0.)+dir*aA.z*age*(1.-.4*k);p.y-=5.*age*age;p.y=max(p.y,.06);
    col=vec3(8.,4.8,1.5);al=pow(1.-k,1.4);
  }
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_PointSize=clamp(size*uScale/max(1.,-mv.z),1.,60.);gl_Position=projectionMatrix*mv;vC=col;vAlpha=al;
}`;
  const PTS_FS = `varying vec3 vC;varying float vAlpha;
void main(){vec2 q=gl_PointCoord*2.-1.;float d=length(q);
  float core=pow(max(0.,1.-d),2.6),halo=pow(max(0.,1.-d),1.15)*.28;
  float star=(exp(-abs(q.x)*14.)*exp(-abs(q.y)*2.2)+exp(-abs(q.y)*14.)*exp(-abs(q.x)*2.2))*.5;
  float v=(core+halo+star)*vAlpha;if(v<.004)discard;gl_FragColor=vec4(vC*v,1.);}`;

  /* o: { T, root, getGame, getSettings, scaleCount, emit, particle, flash } (effects.js) */
  function createWorld(o) {
    const T = o.T, root = o.root;
    const U = { uT: { value: 99 }, uCalm: { value: 0 }, uScale: { value: 1000 }, uHero: { value: new T.Vector3() }, uOrigin: { value: new T.Vector3() } };
    const mk = (fs, extra) => new T.ShaderMaterial(Object.assign({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: U, vertexShader: PLANE_VS, fragmentShader: fs, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }, extra || {}));
    const plane = new T.PlaneGeometry(1, 1);
    const ringsMat = mk(RINGS_FS), sigilMat = mk(SIGIL_FS);
    const rings = new T.Mesh(plane, ringsMat); rings.scale.setScalar(20); rings.rotation.x = -Math.PI / 2; rings.renderOrder = 3; rings.name = 'level-rune-rings';
    const sigil = new T.Mesh(plane, sigilMat); sigil.scale.setScalar(5.2); sigil.rotation.x = -Math.PI / 2; sigil.renderOrder = 4; sigil.name = 'level-sigil';
    const beamGeo = new T.CylinderGeometry(.11, .23, 6.5, 28, 1, true).translate(0, 3.25, 0);
    const shellGeo = new T.CylinderGeometry(.46, .52, 2.5, 40, 1, true).translate(0, 1.25, 0);
    const side = { side: T.DoubleSide, polygonOffset: false, vertexShader: BEAM_VS };
    const beamMat = mk(BEAM_FS, side), shellMat = mk(SHELL_FS, side);
    const beam = new T.Mesh(beamGeo, beamMat); beam.renderOrder = 6; beam.name = 'level-light-shaft';
    const shell = new T.Mesh(shellGeo, shellMat); shell.renderOrder = 7; shell.name = 'level-hero-aura';
    // GPU-animated points: [24 hot sparks][120 helix][96 motes]; positions are computed in the vertex shader from the time uniform
    const NS = 24, NH = 120, NM = 96, N = NS + NH + NM, aA = new Float32Array(N * 4), aB = new Float32Array(N * 4);
    let seed = 20261002; const R = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < NS; i++) { const j = i * 4; aA[j] = R() * 6.2832; aA[j + 1] = .1 + R() * 1.0; aA[j + 2] = 4 + R() * 4.5; aA[j + 3] = R() * .08; aB[j] = 2; aB[j + 1] = .07 + R() * .05; aB[j + 2] = R(); aB[j + 3] = .42 + R() * .4; }
    for (let m = 0; m < NH; m++) { const i = NS + m, j = i * 4, strand = m & 1, step = m >> 1; aA[j] = strand * Math.PI + step * .38; aA[j + 1] = .95 + R() * .42; aA[j + 2] = 3.6 + R() * 1.7; aA[j + 3] = .05 + step * .0085 + strand * .004; aB[j] = 0; aB[j + 1] = .15 + R() * .11; aB[j + 2] = R(); aB[j + 3] = .85 + R() * .5; }
    for (let m = 0; m < NM; m++) { const i = NS + NH + m, j = i * 4; aA[j] = R() * 6.2832; aA[j + 1] = .25 + Math.sqrt(R()) * 1.7; aA[j + 2] = .6 + R() * 1.4; aA[j + 3] = .08 + R() * .85; aB[j] = 1; aB[j + 1] = .1 + R() * .09; aB[j + 2] = R(); aB[j + 3] = 1.4 + R() * 1.0; }
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3)); pg.setAttribute('aA', new T.BufferAttribute(aA, 4)); pg.setAttribute('aB', new T.BufferAttribute(aB, 4));
    const ptsMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: U, vertexShader: PTS_VS, fragmentShader: PTS_FS });
    const pts = new T.Points(pg, ptsMat); pts.frustumCulled = false; pts.renderOrder = 8; pts.name = 'level-sparks'; pg.setDrawRange(0, N);
    const all = [rings, sigil, beam, shell, pts];
    for (const m of all) { m.visible = false; m.frustumCulled = false; root.add(m); }
    let active = false, floorY = .065;
    const heightAt = (x, z) => { const w = B.app && B.app.world; return w && w.effectHeightAt ? w.effectHeightAt(x, z, .85) : .065; };
    const color = new T.Color();
    function place(x, z) {
      floorY = heightAt(x, z);
      sigil.position.set(x, floorY + .04, z); beam.position.set(x, floorY, z); shell.position.set(x, floorY, z); U.uHero.value.set(x, floorY, z);
    }
    function start(x, z) {
      const cfg = o.getSettings(), canvas = B.app && B.app.renderer ? B.app.renderer.domElement : null, q = clamp((cfg.particles || 560) / 560, .3, 1);
      U.uT.value = 0; U.uCalm.value = reduced.matches ? 1 : 0; U.uScale.value = canvas && canvas.height > 0 ? canvas.height : innerHeight;
      floorY = heightAt(x, z); U.uOrigin.value.set(x, floorY, z);
      rings.position.set(x, floorY + .035, z); place(x, z);
      pg.setDrawRange(0, q < .45 ? NS + 72 : N);   // Low: fewer helix sparks, no motes
      for (const m of all) m.visible = true;
      active = true;
      // Pooled particles (one draw call shared with every other effect): hot sparks along the floor, a few rising embers, one star flash.
      const e = o.emit, sc = o.scaleCount, floor = floorY;
      for (let i = 0, n = sc(26); i < n; i++) { const a = i / n * 6.2832 + R() * .3; o.particle(x + Math.sin(a) * .5, floor + .2, z + Math.cos(a) * .5, 1, [5.2, 2.6, .8], 1.9, a, .75); }
      for (let i = 0, n = sc(16); i < n; i++) { const a = R() * 6.2832, rr = .3 + R() * 1.1; e(x + Math.sin(a) * rr, floor + .1, z + Math.cos(a) * rr, 4, i % 3 ? [3.2, .5, .12] : [3.8, 2.1, .6], Math.sin(a) * .15, .9 + R() * 1.1, Math.cos(a) * .15, 1.3 + R() * 1.0, .06 + R() * .03); }
      o.flash(x, floor + 1.1, z, 2.6, color.setRGB(1, .82, .56), .1, 0);
    }
    function step(dt) {
      if (!active) return;
      U.uT.value += dt;
      const g = o.getGame(), p = g && g.player;
      if (p && U.uT.value < 2.4) place(p.x, p.z);
      if (U.uT.value > 2.7) clear();
    }
    function clear() { active = false; U.uT.value = 99; for (const m of all) m.visible = false; }
    function dispose() { clear(); for (const m of all) m.removeFromParent(); for (const g of [plane, beamGeo, shellGeo, pg]) g.dispose(); for (const m of [ringsMat, sigilMat, beamMat, shellMat, ptsMat]) m.dispose(); }
    return { start, step, clear, dispose, get active() { return active; }, parts: [{ geo: plane, mat: ringsMat }, { geo: plane, mat: sigilMat }, { geo: beamGeo, mat: beamMat }, { geo: shellGeo, mat: shellMat }, { geo: pg, mat: ptsMat, points: true }] };
  }

  B.LevelUp = Object.assign(B.LevelUp || {}, { sound, trigger, cancel, step, push, timeScale, paintState, createWorld, TOTAL });
  Object.defineProperties(B.LevelUp, { active: { get() { return S.on; } }, t: { get() { return S.t; } } });
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureDom); else ensureDom(); }
})();
