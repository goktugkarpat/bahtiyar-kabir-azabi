/* KABİR AZABI — standard Xbox-style controllers, remapping and menu navigation. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const KEY = 'baba.kabir.controller.v1';
  const DEFAULTS = Object.freeze({ light: 0, dodge: 1, special: 2, rage: 3, heal: 4, interact: 5, heavy: 7, fourth: 6, pause: 9, character: 10 });
  const NAMES = Object.freeze(['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'Sol çubuk', 'Sağ çubuk', 'Yukarı', 'Aşağı', 'Sol', 'Sağ', 'Xbox']);
  const ACTIONS = Object.freeze({ light: 'Normal saldırı', heavy: 'Yetenek · sağ tık yuvası', special: 'Yetenek · 1 tuşu yuvası', rage: 'Yetenek · 2 tuşu yuvası', fourth: 'Yetenek · 3 tuşu yuvası', dodge: 'Kaçınma', heal: 'Can iksiri', interact: 'Etkileşim', pause: 'Mola', character: 'Karakter ve çanta' });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function stick(x, y) {
    x = Number.isFinite(x) ? x : 0; y = Number.isFinite(y) ? y : 0;
    const length = Math.hypot(x, y), k = length > .18 ? Math.min(1, (length - .18) / .82) / length : 0;
    return [x * k, y * k];
  }
  function buttonDown(button, wasDown) { return !!button && (Number.isFinite(button.value) ? button.value >= (wasDown ? .35 : .55) : !!button.pressed); }
  function create(options) {
    const o = options || {}, getPads = o.getPads || (() => navigator.getGamepads ? navigator.getGamepads() : []);
    const storage = o.storage || window.localStorage, notify = o.notify || function () {};
    let bindings = Object.assign({}, DEFAULTS), activeIndex = null, activeId = '', previous = [], binding = null, captureArmed = false, blocked = false;
    let lastView = null, repeatDirection = '', repeatTime = 0, disconnected = false, status = null, config = null, cancelButton = null;
    const buttons = Object.create(null);
    try {
      const saved = JSON.parse(storage.getItem(KEY));
      if (saved && saved.version === 1 && saved.bindings) {
        const used = new Set();
        for (const action of Object.keys(DEFAULTS)) {
          let index = saved.bindings[action];
          // Saves from before the 4th skill slot carry no `fourth`: it takes LT, or another free button when LT is already used.
          if (action === 'fourth' && index === undefined) index = [DEFAULTS.fourth, 8, 11, 16].find(n => !used.has(n) && !Object.values(saved.bindings).includes(n));
          if (!Number.isInteger(index) || index < 0 || index > 16 || used.has(index)) throw new Error('Geçersiz kontrol kaydı');
          used.add(index); bindings[action] = index;
        }
      }
    } catch (_) { bindings = Object.assign({}, DEFAULTS); }
    function save() { try { storage.setItem(KEY, JSON.stringify({ version: 1, bindings })); } catch (_) { notify('Oyun kolu ayarları bu cihazda saklanamadı.'); } }
    function paint() {
      if (status) status.textContent = activeIndex === null ? 'Oyun kolu bağlı değil. Xbox kolunu bağlayıp bir tuşa bas.' : activeId + ' · bağlı';
      for (const action of Object.keys(buttons)) {
        const button = buttons[action];
        button.textContent = binding === action ? 'Bir tuşa bas…' : NAMES[bindings[action]] || 'Tuş ' + bindings[action];
        button.setAttribute('aria-label', ACTIONS[action] + ': ' + button.textContent);
        button.setAttribute('aria-pressed', binding === action ? 'true' : 'false');
      }
      if (cancelButton) cancelButton.hidden = !binding;
    }
    function capture(action) { if (!Object.hasOwn(DEFAULTS, action)) return false; binding = action; captureArmed = false; blocked = true; paint(); return true; }
    function cancel() { binding = null; captureArmed = false; blocked = true; paint(); }
    function reset() { bindings = Object.assign({}, DEFAULTS); cancel(); save(); notify('Oyun kolu tuşları varsayılana döndü.'); }
    function setBinding(action, index) {
      if (!Object.hasOwn(DEFAULTS, action) || !Number.isInteger(index) || index < 0 || index > 16) return false;
      const other = Object.keys(bindings).find(key => key !== action && bindings[key] === index), old = bindings[action];
      bindings[action] = index; if (other) bindings[other] = old;
      save(); paint(); return true;
    }
    function choose(pads) {
      const all = Array.from(pads || []).filter(p => p && p.connected !== false);
      const current = all.find(p => p.index === activeIndex && p.id === activeId);
      if (current) return current;
      // Prefer standard mapping. The browser translates Xbox USB and Bluetooth layouts into this same contract.
      return all.find(p => p.mapping === 'standard') || all[0] || null;
    }
    function menuElements() {
      const root = o.getMenuRoot && o.getMenuRoot(); if (!root || !root.querySelectorAll) return [];
      return Array.from(root.querySelectorAll('button, input, select, summary, [tabindex]')).filter(el =>
        !el.disabled && el.tabIndex >= 0 && !el.hidden && !el.closest('.hidden,[hidden]') && el.getClientRects().length);
    }
    function navigate(direction) {
      const elements = menuElements(); if (!elements.length) return;
      const current = document.activeElement, index = elements.indexOf(current);
      if (index >= 0 && (direction === 'left' || direction === 'right')) {
        const delta = direction === 'right' ? 1 : -1;
        if (current.tagName === 'INPUT' && current.type === 'range') {
          const step = Number(current.step) || 1, min = Number(current.min) || 0, max = Number(current.max) || 100;
          current.value = clamp(Number(current.value) + delta * step, min, max);
          current.dispatchEvent(new Event('input', { bubbles: true })); current.dispatchEvent(new Event('change', { bubbles: true })); return;
        }
        if (current.tagName === 'SELECT') {
          current.selectedIndex = clamp(current.selectedIndex + delta, 0, current.options.length - 1);
          current.dispatchEvent(new Event('change', { bubbles: true })); return;
        }
      }
      let next;
      if (index < 0) next = elements[0];
      else {
        const r = current.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        let score = Infinity;
        for (const el of elements) {
          if (el === current) continue;
          const q = el.getBoundingClientRect(), dx = q.left + q.width / 2 - x, dy = q.top + q.height / 2 - y;
          const along = direction === 'down' ? dy : direction === 'up' ? -dy : direction === 'right' ? dx : -dx;
          const across = direction === 'down' || direction === 'up' ? Math.abs(dx) : Math.abs(dy);
          if (along < 3) continue;
          const candidate = along + across * 2.5;
          if (candidate < score) { score = candidate; next = el; }
        }
        if (!next) next = elements[(index + (direction === 'up' || direction === 'left' ? -1 : 1) + elements.length) % elements.length];
      }
      next.focus({ preventScroll: true }); if (next.scrollIntoView) next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function menu(pad, down, edges, dt) {
      const left = stick(pad.axes[0], pad.axes[1]);
      const dir = down[12] || left[1] < -.55 ? 'up' : down[13] || left[1] > .55 ? 'down' : down[14] || left[0] < -.55 ? 'left' : down[15] || left[0] > .55 ? 'right' : '';
      if (dir !== repeatDirection) { repeatDirection = dir; repeatTime = .38; if (dir) navigate(dir); }
      else if (dir) { repeatTime -= dt; if (repeatTime <= 0) { repeatTime = .14; navigate(dir); } }
      if (edges[0]) {
        const elements = menuElements(); let focused = document.activeElement;
        if (!elements.includes(focused)) { focused = elements[0]; if (focused) focused.focus(); }
        if (focused) focused.click();
      }
      if (edges[1] && o.onBack) o.onBack();
    }
    function poll(dt) {
      const out = { connected: false, binding: !!binding, x: 0, z: 0, aimX: 0, aimZ: 0, actions: {}, lightHeld: false };
      let pad; try { pad = choose(getPads()); } catch (_) { return out; }
      if (!pad) {
        if (activeIndex !== null) { activeIndex = null; activeId = ''; previous = []; blocked = true; disconnected = true; paint(); if (o.onDisconnect) o.onDisconnect(); notify('Oyun kolu bağlantısı kesildi.'); }
        return out;
      }
      const down = Array.from(pad.buttons || [], (button, index) => buttonDown(button, previous[index]));
      if (pad.index !== activeIndex || pad.id !== activeId) {
        const replacing = activeIndex !== null;
        activeIndex = pad.index; activeId = pad.id || 'Xbox oyun kolu'; previous = down.slice(); blocked = down.some(Boolean);
        repeatDirection = ''; paint(); notify(disconnected || replacing ? 'Oyun kolu yeniden bağlandı.' : 'Oyun kolu bağlandı.'); disconnected = false;
      }
      out.connected = true;
      const edges = down.map((value, index) => value && !previous[index]); previous = down.slice();
      if (binding) {
        if (!down.some(Boolean)) captureArmed = true;
        const pressed = captureArmed ? edges.findIndex(Boolean) : -1;
        if (pressed >= 0) { const action = binding; setBinding(action, pressed); cancel(); notify(ACTIONS[action] + ' → ' + NAMES[pressed]); }
        out.binding = !!binding; return out;
      }
      const view = o.getView ? o.getView() : 'playing';
      // A menu-confirm press cannot become a held attack when its click starts/resumes the game.
      if (lastView !== null && lastView !== view) { blocked = down.some(Boolean); repeatDirection = ''; }
      lastView = view;
      if (blocked) { if (!down.some(Boolean)) blocked = false; else return out; }
      if (edges[view === 'playing' ? bindings.pause : 9] && o.onPause) { o.onPause(); return out; }
      if (view !== 'playing') { menu(pad, down, edges, Number.isFinite(dt) ? Math.min(dt, .1) : 0); return out; }
      repeatDirection = '';
      if (edges[bindings.character] && o.onCharacter) { o.onCharacter(); return out; }
      const left = stick(pad.axes[0], pad.axes[1]), right = stick(pad.axes[2], pad.axes[3]);
      out.x = left[0]; out.z = left[1]; out.aimX = right[0]; out.aimZ = right[1]; out.lightHeld = !!down[bindings.light];
      for (const action of ['light', 'heavy', 'special', 'rage', 'fourth', 'dodge', 'heal', 'interact']) out.actions[action] = !!edges[bindings[action]];
      return out;
    }
    function mount(root) {
      if (!root || config) return;
      config = document.createElement('details'); config.id = 'controller-config'; config.className = 'controller-config';
      const summary = document.createElement('summary'); summary.textContent = 'Xbox / oyun kolu tuşları'; config.appendChild(summary);
      status = document.createElement('p'); status.setAttribute('role', 'status'); config.appendChild(status);
      const note = document.createElement('p'); note.textContent = 'Sol çubuk: hareket · Sağ çubuk: nişan. Menüler: yön tuşları / sol çubuk, A seç, B geri. Tuşa dokunup yeni düğmeye bas; dolu düğmeler yer değiştirir.'; config.appendChild(note);
      const grid = document.createElement('div'); grid.className = 'controller-grid'; config.appendChild(grid);
      for (const action of Object.keys(ACTIONS)) {
        const row = document.createElement('div'), label = document.createElement('span'), button = document.createElement('button');
        label.textContent = ACTIONS[action]; button.type = 'button'; button.className = 'btn small'; button.onclick = () => capture(action);
        row.append(label, button); grid.appendChild(row); buttons[action] = button;
      }
      const footer = document.createElement('div'), restore = document.createElement('button'); restore.type = 'button'; restore.className = 'text-button'; restore.textContent = 'Kol tuşlarını sıfırla'; restore.onclick = reset;
      cancelButton = document.createElement('button'); cancelButton.type = 'button'; cancelButton.className = 'text-button'; cancelButton.textContent = 'Atamayı iptal et'; cancelButton.onclick = cancel;
      footer.append(restore, cancelButton); config.appendChild(footer);
      const scrollArea = root.querySelector('.settings-cols');
      if (scrollArea) scrollArea.appendChild(config);
      else { const panelFooter = root.querySelector('footer'); root.insertBefore(config, panelFooter || null); }
      const style = document.createElement('style'); style.textContent = '#controller-config{grid-column:1/-1;min-width:0;margin:12px 0;padding:12px;border:1px solid #79604466;color:#d8c5ae}#controller-config summary{cursor:pointer;font-weight:600}#controller-config p{font:inherit;font-size:13px;line-height:1.5;margin:10px 0}#controller-config .controller-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px}#controller-config .controller-grid>div{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}#controller-config button{min-width:85px}#controller-config [aria-pressed=true]{outline:2px solid #e6bf77}#controller-config>div:last-child{display:flex;gap:16px;margin-top:12px}@media(max-width:580px){#controller-config .controller-grid{grid-template-columns:1fr}}'; document.head.appendChild(style); paint();
    }
    const keyHandler = e => { if (binding && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); } };
    window.addEventListener('keydown', keyHandler, true);
    return { poll, mount, capture, cancel, reset, setBinding, get bindings() { return Object.assign({}, bindings); }, get connectedIndex() { return activeIndex; }, get binding() { return binding; }, dispose() { window.removeEventListener('keydown', keyHandler, true); if (config) config.remove(); } };
  }
  B.Controller = Object.freeze({ create, defaults: DEFAULTS, names: NAMES, actions: ACTIONS, stick, buttonDown });
}());
