/* KABİR AZABI — HUD art that CSS cannot draw: liquid glass orbs (WebGL, 2D fallback)
   and engraved damage numerals for effects.js. Presentation only; reads game state, never changes it. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* ───────────── Liquid orbs ───────────── */
  const VERT = 'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.,1.);}';
  const FRAG = `precision highp float;
  uniform float time,fill,trail,low,flash,heal,calm;uniform vec3 deep,mid,bright,rim;varying vec2 uv;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
  void main(){
    vec2 p=uv*1.035;float r=length(p);if(r>1.){gl_FragColor=vec4(0.);return;}
    float z=sqrt(1.-r*r),t=time*calm;
    vec2 q=p*(1.+.42*(1.-z));
    float lvl=-1.+2.*fill,edge=1.-pow(abs(2.*fill-1.),8.);
    float wave=(.04*sin(p.x*4.6+t*2.2)+.022*sin(p.x*9.3-t*3.4)+.012*sin(p.x*17.-t*5.))*edge;
    float surf=lvl+wave,tl=-1.+2.*max(trail,fill)+wave*.6;
    float inL=(1.-smoothstep(surf-.012,surf+.012,p.y)),inT=(1.-smoothstep(tl-.012,tl+.012,p.y))*(1.-inL);
    vec2 fl=vec2(fbm(q*2.1+vec2(0.,t*.25)),fbm(q*2.1+vec2(5.2,-t*.19)));
    float sw=fbm(q*2.7+fl*1.9+vec2(t*.05,-t*.32));
    float veins=pow(1.-abs(fbm(q*4.+fl*2.5-t*.1)*2.-1.),6.);
    float d=clamp((surf-p.y)*.55,0.,1.);
    vec3 liq=mix(bright,mid,smoothstep(0.,.5,d));
    liq=mix(liq,deep,smoothstep(.15,1.,d+(1.-z)*.7));
    liq*=.55+.9*sw;liq+=bright*veins*.28;
    liq+=bright*.42*pow(z,4.)*(.5+.5*sw);
    float band=exp(-pow((p.y-surf)/.028,2.));
    liq+=bright*band*.85*inL;liq+=mix(bright,vec3(1.),.5)*band*.25*(1.-inL);
    // rising bubbles
    for(int k=0;k<7;k++){float fk=float(k);vec2 c=vec2(fract(sin(fk*12.9)*43.7)*1.4-.7,-1.+fract(t*(.06+.03*fract(fk*.37))+fk*.31)*2.);
      float s=.018+.02*fract(fk*.71);float b=(1.-smoothstep(s*.4,s,length(p-c)));liq+=bright*b*.5*step(c.y,surf-.02);}
    // empty glass: smoky interior with a faint reflection of the liquid below
    vec3 emp=vec3(.026,.016,.017)+mid*.13*fbm(q*1.6+vec2(t*.06,t*.1))*(1.-.5*z)+rim*.12*pow(1.-z,2.)+bright*.05*(1.-smoothstep(-.2,.3,p.y-surf));
    vec3 col=mix(emp,liq,inL);
    col=mix(col,mix(bright,vec3(1.,.8,.7),.28)*(.62+.25*sw),inT*.72);
    col+=bright*flash*.35*inL;col+=vec3(1.,.85,.6)*heal*.35*inL;
    col+=deep*low*.9*(.5+.5*sin(time*6.3))*inL;
    float fr=pow(1.-z,2.6);
    col=col*(1.-fr*.55)+rim*fr*.55;
    vec2 a=(p-vec2(-.34,.46))*vec2(1.,1.7);col+=vec3(1.,.95,.88)*exp(-dot(a,a)*16.)*.42;
    float cres=smoothstep(.74,.93,r)*(1.-smoothstep(.86,.93,r))*smoothstep(.35,.95,dot(p/max(r,.001),vec2(-.62,.78)));col+=vec3(1.,.93,.85)*cres*.55;
    vec2 b2=p-vec2(-.58,.18);col+=vec3(1.)*exp(-dot(b2,b2)*160.)*.45;
    col+=vec3(1.,.9,.8)*smoothstep(.93,.99,r)*smoothstep(.1,.7,p.y)*.18;
    col+=rim*pow(max(0.,-p.y),3.)*fr*1.1;
    col*=mix(.35,1.,(1.-smoothstep(.83,1.,r)));
    gl_FragColor=vec4(col,(1.-smoothstep(.985,1.,r)));
  }`;
  const PALETTE = {
    health: { deep: [.16, .0, .015], mid: [.52, .02, .035], bright: [1, .17, .09], rim: [.75, .22, .12] },
    stamina: { deep: [.19, .055, .0], mid: [.6, .27, .03], bright: [1, .66, .24], rim: [.82, .44, .15] },
    winded: { deep: [.22, .02, .0], mid: [.62, .14, .03], bright: [1, .42, .12], rim: [.8, .3, .12] }
  };
  function makeOrb(canvas, kind) {
    const st = { fill: 1, trail: 1, target: 1, low: 0, flash: 0, heal: 0, pal: PALETTE[kind], dirty: true };
    let gl = null, u = {}, pr = null, ext = null, linked = false, lost = false;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }); } catch (e) { gl = null; }
    function compile() {
      if (!gl) return;
      // Compiled in the background (KHR_parallel_shader_compile where available); first use waits until it is done
      // so starting the chapter never stalls on it (app.js starts it while the loading screen is up).
      try {
        ext = gl.getExtension('KHR_parallel_shader_compile');
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        pr = gl.createProgram();
        const vertex = sh(gl.VERTEX_SHADER, VERT), fragment = sh(gl.FRAGMENT_SHADER, FRAG);
        gl.attachShader(pr, vertex); gl.attachShader(pr, fragment); gl.linkProgram(pr);
        gl.deleteShader(vertex); gl.deleteShader(fragment);
      } catch (e) { console.warn('[Kabir Azabı] orb shader', e); gl = null; }
    }
    compile();
    if (canvas.addEventListener) {
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; linked = false; pr = null; u = {}; st.dirty = true; });
      canvas.addEventListener('webglcontextrestored', () => { lost = false; linked = false; u = {}; measure = true; warmDrawn = false; compile(); force(); });
    }
    function finish(force) {
      if (lost) return false;
      if (linked || !gl) return linked;
      if (!force && ext && !gl.getProgramParameter(pr, ext.COMPLETION_STATUS_KHR)) return false;
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn('[Kabir Azabı] orb shader', gl.getProgramInfoLog(pr)); gl = null; return false; }
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ['time', 'fill', 'trail', 'low', 'flash', 'heal', 'calm', 'deep', 'mid', 'bright', 'rim']) u[k] = gl.getUniformLocation(pr, k);
      linked = true; return true;
    }
    const ctx = gl ? null : canvas.getContext('2d');
    // Backing-store size follows the CSS size; measured only when the layout changes (ResizeObserver).
    let measure = true;
    if (window.ResizeObserver) new ResizeObserver(() => { measure = true; }).observe(canvas); else addEventListener('resize', () => { measure = true; });
    function size() {
      if (!measure && canvas.width > 2) return; measure = false;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; st.dirty = true; }
      if (r.width < 1) measure = true;   // still hidden: try again next frame
    }
    function draw(time) {
      if (lost) return;
      size(); const p = st.pal;
      if (gl) {
        if (!finish()) return;
        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(u.time, time); gl.uniform1f(u.fill, st.fill); gl.uniform1f(u.trail, st.trail); gl.uniform1f(u.low, st.low); gl.uniform1f(u.flash, st.flash); gl.uniform1f(u.heal, st.heal); gl.uniform1f(u.calm, reduced.matches ? .15 : 1);
        gl.uniform3fv(u.deep, p.deep); gl.uniform3fv(u.mid, p.mid); gl.uniform3fv(u.bright, p.bright); gl.uniform3fv(u.rim, p.rim);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (ctx) {
        const w = canvas.width, h = canvas.height, c = (x) => `rgb(${x.map(v => Math.round(clamp(v, 0, 1) * 255)).join(',')})`;
        ctx.clearRect(0, 0, w, h); ctx.save(); ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#070304'; ctx.fillRect(0, 0, w, h);
        const top = h * (1 - st.fill), g = ctx.createLinearGradient(0, top, 0, h); g.addColorStop(0, c(p.bright)); g.addColorStop(.35, c(p.mid)); g.addColorStop(1, c(p.deep));
        ctx.fillStyle = g; ctx.fillRect(0, top, w, h - top);
        const hl = ctx.createRadialGradient(w * .33, h * .25, 0, w * .33, h * .25, w * .3); hl.addColorStop(0, '#ffffff55'); hl.addColorStop(1, '#fff0');
        ctx.fillStyle = hl; ctx.fillRect(0, 0, w, h); ctx.restore();
      }
      st.dirty = false;
    }
    return { st, draw, get webgl() { return !!gl; }, get ready() { return !gl || finish(); }, force() { return !gl || finish(true); } };
  }

  const orbs = {};
  let clock = 0, warmDrawn = false;
  function ensure() {
    if (!orbs.health) { const h = document.getElementById('orb-health'), s = document.getElementById('orb-stamina'); if (h) orbs.health = makeOrb(h, 'health'); if (s) orbs.stamina = makeOrb(s, 'stamina'); }
    return orbs.health;
  }
  function step(dt) {
    for (const k in orbs) {
      const o = orbs[k].st;
      o.fill += (o.target - o.fill) * (1 - Math.exp(-dt * 14));
      if (o.trailHold > 0) o.trailHold -= dt; else o.trail += (o.fill - o.trail) * (1 - Math.exp(-dt * 3.2));
      if (o.trail < o.fill) o.trail = o.fill;
      o.flash = Math.max(0, o.flash - dt * 2.5); o.heal = Math.max(0, o.heal - dt * 1.4);
    }
  }
  function render() { for (const k in orbs) orbs[k].draw(clock); }
  // The app calls this once per presented scene frame; HUD ticks only supply new targets.
  function frame(dt) {
    const view = document.body.dataset.view, hud = document.getElementById('hud');
    if (view !== 'playing' || !hud || hud.classList.contains('hidden')) return;
    if (!ensure()) return;
    dt = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0; clock += dt;
    step(dt); render();
  }
  // Stamina reading in the orb (health's is written by app.js). Floor keeps it consistent with the 20 / 34 stamina thresholds.
  const reading = { num: undefined, max: null, n: -1, m: -1 };
  function staminaText(p) {
    if (reading.num === undefined) { reading.num = document.getElementById('stamina-number'); reading.max = document.getElementById('stamina-max'); }
    if (!reading.num || !reading.max) return;
    const m = Math.round(p.maxStamina || 0), n = Math.floor(clamp(p.stamina || 0, 0, m));
    if (n !== reading.n) { reading.n = n; reading.num.textContent = n; }
    if (m !== reading.m) { reading.m = m; reading.max.textContent = '/ ' + m; }
  }
  // Called by app.js with the player every HUD tick.
  function vitals(p) {
    if (!ensure()) return;
    const hp = clamp(p.hp / (p.maxHp || 1), 0, 1), st = clamp(p.stamina / (p.maxStamina || 1), 0, 1);
    const H = orbs.health.st, S = orbs.stamina && orbs.stamina.st;
    staminaText(p);
    if (hp < H.target - .002) { H.trailHold = .42; H.flash = Math.min(1, H.flash + .6); }
    if (hp > H.target + .02) { H.heal = 1; H.trail = hp; }
    H.target = hp; H.low = hp < .3 && !p.dead ? 1 : 0;
    if (S) {
      if (st < S.target - .004) S.trailHold = .25;
      S.target = st;
      const winded = p.stamina < 20; S.pal = winded ? PALETTE.winded : PALETTE.stamina; S.low = winded ? .45 : 0;
    }
  }
  function reset(p) { if (!ensure()) return; for (const k in orbs) { const o = orbs[k].st; o.fill = o.trail = o.target = 1; o.flash = o.heal = o.low = o.trailHold = 0; } if (p) vitals(p); render(); }

  /* ───────────── Damage numerals (drawn into a sprite canvas by effects.js) ───────────── */
  function damageCanvas(value, player, heavy, canvas) {
    const c = canvas || document.createElement('canvas'); c.width = 256; c.height = 144;
    const x = c.getContext('2d'), text = String(value), size = heavy ? 104 : player ? 88 : 84;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `800 ${size}px 'Source Sans 3', 'Segoe UI', sans-serif`;
    x.save(); x.translate(128, 74);
    // soft dark halo keeps numbers readable on bright floors and torches
    x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16; x.lineJoin = 'round';
    x.lineWidth = 16; x.strokeStyle = '#0d0506'; x.strokeText(text, 0, 0); x.shadowBlur = 0;
    x.lineWidth = 7; x.strokeStyle = player ? '#3a0508' : heavy ? '#3b1b06' : '#1d1414'; x.strokeText(text, 0, 0);
    x.fillStyle = player ? '#ff9d87' : heavy ? '#ffe0a0' : '#f5eddf';
    x.fillText(text, 0, 0); x.restore();
    return c;
  }

  /* ───────────── Impact callouts (parry) ───────────── */
  let calloutTimer = 0;
  function callout(text, kind = '') {
    const hud = document.getElementById('hud'); if (!hud) return;
    let el = document.getElementById('callout');
    if (!el) { el = document.createElement('div'); el.id = 'callout'; el.setAttribute('aria-hidden', 'true'); hud.appendChild(el); }
    el.textContent = text; el.className = ''; void el.offsetWidth; el.className = 'show ' + kind;
    clearTimeout(calloutTimer); calloutTimer = setTimeout(() => { el.className = ''; }, 950);
  }

  /* ───────────── Skill slots: cooldown sweeps, seconds, stamina cost hints ───────────── */
  // Slot key -> stamina cost shown in the corner and used for the "not enough stamina" dim (numbers mirror combat.js).
  const SLOT_COST = { light: 13, heavy: 34, dodge: 20, special: 45 };
  const slots = {};
  function slotFor(key) {
    if (slots[key]) return slots[key];
    const el = document.querySelector(key === 'heal' ? '.flask-button' : `.action-${key}`); if (!el) return null;
    const cd = document.createElement('i'); cd.className = 'cd'; cd.setAttribute('aria-hidden', 'true'); cd.innerHTML = '<b></b>';
    el.insertBefore(cd, el.querySelector('kbd'));
    if (SLOT_COST[key]) { const c = document.createElement('em'); c.className = 'cost'; c.setAttribute('aria-hidden', 'true'); c.textContent = SLOT_COST[key]; el.appendChild(c); }
    return slots[key] = { el, txt: cd.firstChild, cd: -1, shown: '', prevCd: 0, lackSerial: 0 };
  }
  function pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // fraction = share of the wait still to come (0 = ready), text = seconds to write over the slot.
  function setCd(sl, fraction, text) {
    const f = Math.round(fraction * 200) / 200;
    if (f !== sl.cd) { sl.cd = f; sl.el.style.setProperty('--cd', f); }
    if (text !== sl.shown) { sl.shown = text; sl.txt.textContent = text; }
  }
  const secs = t => t > 9.5 ? String(Math.ceil(t)) : t > 0 ? (Math.ceil(t * 10) / 10).toFixed(1) : '';
  function skills(p) {
    const st = p.stamina || 0, lack = p.lack;
    for (const key of ['light', 'heavy', 'dodge', 'special', 'rage', 'heal']) {
      const sl = slotFor(key); if (!sl) continue;
      // A respawn clears p.lack and starts its serial again; forget the old run's alert.
      if (!lack) sl.lackSerial = 0;
      let f = 0, text = '', dim = false;
      if (key === 'special') {
        const cd = p.specialCd || 0; f = cd / (p.specialMax || 8); text = secs(cd); dim = cd <= 0 && st < SLOT_COST.special;
        if (sl.prevCd > 0 && cd <= 0 && !reduced.matches) pulse(sl.el, 'ready-flash');
        sl.prevCd = cd;
      } else if (key === 'rage') {
        if (p.rageTime > 0) text = secs(p.rageTime);
      } else if (key === 'heal') {
        f = clamp((p.drink || 0) / .34, 0, 1);
      } else if (key === 'dodge') {
        f = p.dodge > 0 ? clamp(p.dodge / .48, 0, 1) : 0; dim = st < SLOT_COST.dodge;
      } else if (SLOT_COST[key]) dim = st < SLOT_COST[key];
      setCd(sl, f, text);
      sl.el.classList.toggle('short', dim);
      sl.el.classList.toggle('cooling', f > 0 && key === 'special');
      if (lack && lack.key === key && lack.serial !== sl.lackSerial) { sl.lackSerial = lack.serial; pulse(sl.el, 'lack'); }
    }
  }


  /* ───────────── Skill cards: hover / keyboard focus / long press on a slot shows name, key, what it does, cost and cooldown ───────────── */
  const TIPS = {
    light: ['Hafif saldırı', 'Atanmış fare düğmesiyle düşmanı seç: yaklaşır ve üç vuruşluk kombo yapar; basılı tutunca sürdürür. Klavye tuşu önündeki yakın düşmana vurur. Kalkanlı düşmanın gardını kıramaz. Yerinde vur tuşuyla birlikte fareden saldırırsan yürümez.', '13 dayanıklılık'],
    heavy: ['Ağır saldırı', 'Yavaş ama çok sert vurur; kalkanlı düşmanın gardını kırar, hafif düşmanları sendeletir. Atanmış fare düğmesiyle düşmanı seç; boş yere tıklamak saldırmaz. Klavye tuşu önündeki yakın düşmana vurur. Yerinde vur tuşuyla birlikte fareden saldırırsan yürümez.', '34 dayanıklılık'],
    dodge: ['Kaçınma', 'Yürüdüğün yöne (yürümüyorsan fareye doğru) yuvarlanır. Yuvarlanmanın başında darbelerden korunursun; sondaki kalkışta koruma biter. Kızıl ve altın kenarlı darbelerden böyle kaç.', '20 dayanıklılık'],
    heal: ['Can iksiri', 'Anında can yeniler. Yemin taşında yeniden dolar.', 'sınırlı sayıda'],
    special: ['Zincir Girdabı', 'Zincirli pala ile etrafında dönersin ve yakındaki herkese 4 kez vurursun. Hafif düşmanlar içeri çekilir, son vuruş onları savurur. Dönerken yürüyebilirsin.', '45 dayanıklılık · 8 sn bekleme'],
    rage: ['Kan Öfkesi', 'Öfke çubuğu dolunca bağırırsın: yakındaki düşmanlar sendeler. 11 sn boyunca %48 daha sert vurur, %25 az hasar alır ve vurduğun hasarın bir kısmı can olarak geri döner.', 'Öfke çubuğu dolu olmalı']
  };
  function initTips() {
    const tip = document.createElement('div'); tip.id = 'skill-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    let hideTimer = 0;
    function show(btn) {
      const key = btn.dataset.action || btn.dataset.hold, t = TIPS[key]; if (!t) return;
      const kbd = btn.querySelector('kbd'), cap = kbd ? kbd.textContent.trim() : '';
      tip.innerHTML = '';
      const head = document.createElement('div'); head.className = 'tip-head';
      const name = document.createElement('b'); name.textContent = t[0]; head.appendChild(name);
      if (cap) { const k = document.createElement('kbd'); k.textContent = cap; head.appendChild(k); }
      const body = document.createElement('p'); body.textContent = t[1];
      const foot = document.createElement('small'); foot.textContent = t[2];
      tip.append(head, body, foot);
      tip.classList.add('show');
      const r = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tip.style.top = Math.max(8, r.top - h - 12) + 'px';
    }
    function hide() { clearTimeout(hideTimer); tip.classList.remove('show'); }
    for (const btn of document.querySelectorAll('.combat-pad .action, .flask-button')) {
      btn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(btn); });
      btn.addEventListener('pointerleave', hide);
      btn.addEventListener('focus', () => show(btn)); btn.addEventListener('blur', hide);
      let press = 0;   // touch: hold a slot for half a second to read it (the tap itself still acts)
      btn.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { hide(); return; } clearTimeout(press); press = setTimeout(() => { show(btn); hideTimer = setTimeout(hide, 4200); }, 520); });
      for (const ev of ['pointerup', 'pointercancel']) btn.addEventListener(ev, () => clearTimeout(press));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTips); else initTips();

  // Finish the orb programs now even if the browser has not reported them compiled (blocks once, during loading).
  function force(redraw = false) { if (!ensure()) return; for (const k in orbs) orbs[k].force(); if (redraw || !warmDrawn) { warmDrawn = true; render(); } }
  B.HUD = { frame, vitals, skills, reset, damageCanvas, callout, prepare: ensure, force, get webgl() { return !!(orbs.health && orbs.health.webgl); },
    // Ready once compiled; the first draw is made here too (some drivers finish the program only on its first draw).
    get ready() { const ok = !orbs.health || Object.keys(orbs).every(k => orbs[k].ready); if (ok && orbs.health && !warmDrawn) { warmDrawn = true; render(); } return ok; } };
})();
