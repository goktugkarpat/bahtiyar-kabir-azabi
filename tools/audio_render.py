"""Render game music/ambience/sfx through BABA.Audio.renderOffline into WAV files (no speakers involved).
usage: python render.py <worktree> <outdir> [filter]"""
import sys, os, base64, wave, json, time
sys.path.insert(0, r'C:\Users\gktgk\AppData\Local\Temp\claude\C--Users-gktgk-Dropbox-Game-Development\d0282e08-f18e-4d64-9193-13a89766a60d\scratchpad\qa')
from qa import Game

ROOT = sys.argv[1]; OUT = sys.argv[2]; FILT = sys.argv[3] if len(sys.argv) > 3 else ''
os.makedirs(OUT, exist_ok=True)

JS = r"""async (a) => {
  const {chapter, kind, seconds, vol, events} = a;
  const W = BABA.app.world, savedCh = BABA.ActiveChapter, savedView = BABA.app.view;
  let savedWC; try { savedWC = W.chapter; Object.defineProperty(W, 'chapter', {value: chapter, configurable: true, writable: true}); } catch (e) {}
  BABA.ActiveChapter = chapter;
  const P = {x: 0, z: 0, hp: 100, maxHp: 100, face: 0};
  const boss = {x: 7, z: 0, active: true, activated: true, boss: true, dead: false, phase: 1, type: 'boss', hp: 1000, maxHp: 1000};
  const foe = {x: 4, z: 1, active: true, dead: false, type: 'guard', hp: 50, maxHp: 50};
  const G = {player: P, enemies: [], state: 'playing', room: a.room == null ? 2 : a.room};
  if (kind === 'combat') G.enemies = [foe];
  if (kind === 'boss') { G.enemies = [boss]; G.boss = boss; }
  const viewDesc = Object.getOwnPropertyDescriptor(BABA.app, 'view');
  if (kind === 'title') Object.defineProperty(BABA.app, 'view', {get: () => 'title', configurable: true});
  const st = {playing: kind !== 'title', combat: kind === 'combat' || kind === 'boss', boss: kind === 'boss', title: kind === 'title'};
  const ev = [];
  if (kind === 'boss') ev.push([seconds / 2, 'fn', g => { boss.phase = 2; }]);
  if (kind === 'boss3') {}
  for (const e of (events || [])) ev.push(e);
  if (a.say) ev.push([a.say[0], 'say', a.say[1], true]);
  if (a.plays) for (const p of a.plays) ev.push([p[0], 'play', p[1], p[2] || {}]);
  if (a.lowhp) P.hp = 20;
  ev.push([seconds * (a.dbgAt || .6), 'fn', () => { window.__mdbg = JSON.stringify([BABA.ActiveChapter, BABA.Music.ready && BABA.Music.stats().parts, BABA.AudioPlus && BABA.AudioPlus.stats, BABA.CoastWeather]); }]);
  if (a.bosshp) boss.hp = a.bosshp;
  if (a.uiplus) for (const u of a.uiplus) ev.push([u[0], 'fn', () => BABA.AudioPlus && BABA.AudioPlus.ui(u[1])]);
  const savedW = BABA.CoastWeather; if (a.weather) { const W2 = BABA.CoastWeather = {rain: .9, flash: 0}; for (const f of a.weather) { ev.push([f, 'fn', () => { W2.flash = 1; }]); ev.push([f + .3, 'fn', () => { W2.flash = 0; }]); } }
  const t0 = performance.now();
  let buf;
  // the live game keeps ticking in the page: its own sound calls (a hero dying off-screen) must not leak into the render
  const BLOCK = ['play', 'say', 'sayQuest', 'update', 'suspend', 'resume', 'set', 'unlock'], SAVED = {};
  for (const k of BLOCK) { SAVED[k] = BABA.Audio[k]; BABA.Audio[k] = () => {}; }
  try {
    buf = await BABA.Audio.renderOffline({seconds, music: kind !== 'sfx' && vol.music > 0, game: G, state: st, volume: vol, step: .02, events: ev});
  } finally {
    for (const k of BLOCK) BABA.Audio[k] = SAVED[k];
    BABA.ActiveChapter = savedCh; Object.defineProperty(BABA.app, 'view', viewDesc); BABA.CoastWeather = savedW;
    try { Object.defineProperty(W, 'chapter', {value: savedWC, configurable: true, writable: true}); } catch (e) {}
  }
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, u = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) { u[2*i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); u[2*i+1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))); }
  let s = ''; const b = new Uint8Array(u.buffer); for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
  return {b64: btoa(s), sr: buf.sampleRate, ms: performance.now() - t0, dbg: window.__mdbg};
}"""

FULL = {'master': .65, 'music': .42, 'sfx': .75, 'ambient': .5, 'voice': .85}
MUS = dict(FULL, sfx=0, ambient=0, voice=0)
AMB = dict(FULL, music=0, sfx=0, voice=0)
SFX = dict(FULL, music=0, ambient=0, voice=0)

jobs = []
for c in (1, 2, 3, 4, 5):
    jobs.append((f'ch{c}_explore', c, dict(kind='explore', seconds=40, vol=MUS, room=2)))
    jobs.append((f'ch{c}_combat', c, dict(kind='combat', seconds=24, vol=MUS, room=2, dbgAt=.92)))
    jobs.append((f'ch{c}_boss', c, dict(kind='boss', seconds=32, vol=MUS, room=6)))
    jobs.append((f'ch{c}_amb', c, dict(kind='explore', seconds=30, vol=AMB, room=2)))
    jobs.append((f'ch{c}_mix', c, dict(kind='explore', seconds=30, vol=FULL, room=2, say=[6, 'intro'])))
for c in (1, 2, 3, 4, 5):
    jobs.append((f'ch{c}_boss3', c, dict(kind='boss', seconds=24, vol=MUS, room=6, bosshp=200)))
jobs.append(('ch2_thunder', 2, dict(kind='explore', seconds=24, vol=AMB, room=2, weather=[3, 13])))
jobs.append(('ch1_lowhp', 1, dict(kind='explore', seconds=12, vol=SFX, room=1, lowhp=True)))
jobs.append(('title', 1, dict(kind='title', seconds=30, vol=MUS, room=0)))
ui = [[.3, 'ui'], [1.0, 'levelUp'], [4.0, 'lootPickup', {'rarity': 'legendary'}], [5.5, 'checkpoint'], [8.5, 'heal'], [10, 'globe']]
jobs.append(('ui_plus', 1, dict(kind='sfx', seconds=12, vol=SFX, uiplus=[[.3, 'open'], [1.3, 'close'], [2.3, 'map'], [3.5, 'equip'], [4.6, 'unequip'], [5.6, 'deny'], [6.8, 'quest']])))
jobs.append(('ui_sfx', 1, dict(kind='sfx', seconds=12, vol=SFX, plays=ui)))
steps = [[.4 + i * .36, 'step'] for i in range(14)]
for c in (1, 2, 3, 4, 5):
    jobs.append((f'steps_ch{c}', c, dict(kind='sfx', seconds=6, vol=SFX, plays=steps, room=1)))
cmb = [[.3, 'swing'], [.45, 'hit'], [1.2, 'heavy'], [1.5, 'heavyHit'], [2.4, 'hurt'], [3.2, 'dodge'], [4.0, 'kill'], [5, 'death']]
jobs.append(('combat_sfx', 1, dict(kind='sfx', seconds=9, vol=SFX, plays=cmb)))
stress = [[t0 + e[0], e[1]] for t0 in (1, 4, 7, 10, 13) for e in cmb if e[1] != 'death']
jobs.append(('stress_all', 4, dict(kind='boss', seconds=18, vol=FULL, room=6, plays=stress, say=[2, 'forgeBoss'], bosshp=250)))

with Game(root=ROOT, chapter=1, level=3, width=640, height=360) as g:
    g.play(); g.step(30)
    for name, c, a in jobs:
        if FILT and FILT not in name: continue
        a['chapter'] = c
        r = g.js('(' + JS + ')(' + json.dumps(a) + ')')
        pcm = base64.b64decode(r['b64'])
        with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(r['sr']); w.writeframes(pcm)
        print(name, 'render ms', int(r['ms']), r.get('dbg'), flush=True)
    print('errors', g.errors[:5]); print('warn', [c for c in g.console if any(k in c for k in ('Audio', 'Music'))][:8])
