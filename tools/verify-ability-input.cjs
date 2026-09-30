'use strict';
// Real combat/world/models, with inert canvas and audio: no browser or sound playback.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.argv[2] || path.resolve(__dirname, '..');
global.window = global; global.self = global;
Object.defineProperty(global, 'navigator', { value: { userAgent: 'Node silent ability QA', platform: 'Win32' }, configurable: true });
global.location = { search: '?sessiz', href: 'file:///ability-qa?sessiz' };
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
function canvas() {
  const c = { width: 1, height: 1, style: {}, toDataURL: () => '', getBoundingClientRect: () => ({ width: c.width, height: c.height }) };
  const ctx = new Proxy({ canvas: c, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), measureText: s => ({ width: String(s).length * 10 }) },
  { get: (o, k) => k in o ? o[k] : () => {} });
  c.getContext = k => k === '2d' ? ctx : null; return c;
}
global.document = { createElement: () => canvas(), getElementById: () => ({ width: 1920, height: 1080 }), readyState: 'loading', addEventListener() {} };
global.Image = class { constructor() { this.width = this.height = 1024; } set src(s) { queueMicrotask(() => this.onload && this.onload()); } };
const load = n => vm.runInThisContext(fs.readFileSync(path.join(root, n), 'utf8'), { filename: path.join(root, n) });
load('vendor/three.js'); load('vendor/gltf-loader.js');
THREE.TextureLoader.prototype.load = function (url, onLoad) { const t = new THREE.Texture({ width: 1024, height: 1024 }); queueMicrotask(() => onLoad(t)); return t; };
THREE.PMREMGenerator = class { fromScene() { return { texture: new THREE.Texture() }; } dispose() {} };
for (const n of ['src/materials.js', 'src/models.js', 'assets/characters/characters.js', 'assets/characters/authored-clips.js',
  'src/authored-motion.js', 'src/authored-models.js', 'src/world.js', 'src/limbs.js', 'src/globes.js', 'src/combat.js']) load(n);

(async () => {
  await BABA.Models.prepare({ textureScale: 1 });
  const scene = new THREE.Scene(), world = BABA.World.build(scene, { multiDraw: true }), events = [];
  const game = BABA.Game.create(world, { scene, emit: (name, data) => events.push({ name, data }), fx() {}, sound() {} });
  game.setQuality({ impact: 0 });
  const resources = BABA.Game.resources;
  assert(Object.isFrozen(resources) && Object.isFrozen(resources.costs) && Object.isFrozen(resources.cooldowns) && Object.isFrozen(resources.durations));
  assert.throws(() => { resources.costs.rage = 0; }, TypeError, 'Combat and the HUD share a read-only resource contract');
  assert.throws(() => { BABA.Game.resources = {}; }, TypeError);
  assert(!('rage' in game.player) && !('maxRage' in game.player), 'There is no separate fury meter or combat prerequisite');
  const reset = () => { game.restart(); game.debug.invincible(true); for (const e of game.enemies) e.cooldown = 999; events.length = 0; };
  const tick = (s, fps, input = {}) => { for (let i = 0; i < Math.ceil(s * fps); i++) game.update(1 / fps, typeof input === 'function' ? input(i) : input); };
  const press = (key, fps) => game.update(1 / fps, { [key]: true });
  const specialStarts = () => events.filter(e => e.name === 'attack' && e.data.special).length;
  const rageStarts = () => events.filter(e => e.name === 'rageStart').length;
  const dodgeStarts = () => events.filter(e => e.name === 'dodge').length;
  const waitForContactPause = fps => { for (let i = 0; i < Math.ceil(.4 * fps) && !(game.hitStop > 0); i++) game.update(1 / fps, {}); assert(game.hitStop > 0, 'An actual cry contact starts a brief pause'); };
  const finitePose = () => {
    const p = game.player, model = p.model.root;
    for (const value of [p.x, p.z, p.face, p.yaw, model.position.x, model.position.y, model.position.z,
      model.rotation.x, model.rotation.y, model.rotation.z, ...model.matrixWorld.elements]) assert(Number.isFinite(value), 'Partial roll input must keep player and model pose finite');
  };
  for (const fps of [30, 60, 144, 240]) {
    // Game.update accepts sparse input. Missing/invalid axes are zero, including in the roll's raw input path.
    // A bad facing poisons the camera and its camera-facing spark ribbons even when world collision repairs x/z.
    for (const [axes, direction] of [
      [{ z: 1 }, [0, 1]], [{ x: 1 }, [1, 0]],
      [{ x: NaN, z: 1 }, [0, 1]], [{ x: Infinity, z: 1 }, [0, 1]], [{ x: -Infinity, z: 1 }, [0, 1]],
      [{ x: 1, z: NaN }, [1, 0]], [{ x: 1, z: Infinity }, [1, 0]], [{ x: 1, z: -Infinity }, [1, 0]],
      [{ x: undefined, z: 1 }, [0, 1]], [{ x: 1, z: null }, [1, 0]], [{ x: 'invalid', z: 1 }, [0, 1]],
      [{ x: NaN, z: Infinity }, [0, -1]], [{ x: Infinity, z: NaN }, [0, -1]]
    ]) {
      reset(); const x = game.player.x, z = game.player.z;
      game.update(1 / fps, { dodge: true, ...axes }); finitePose(); assert(game.player.dodge > 0);
      for (let i = 0; i < Math.ceil(.3 * fps); i++) { game.update(1 / fps, {}); finitePose(); }
      const dx = game.player.x - x, dz = game.player.z - z, [vx, vz] = direction;
      assert(dx * vx + dz * vz > 1, 'Roll moves along the remaining valid axis, or the facing when both are invalid');
      assert(Math.abs(dx * vz - dz * vx) < .05, 'An absent axis cannot add lateral movement');
    }
    reset();
    game.update(1 / fps, { stand: true, clickHeavy: true, pointX: game.player.x, pointZ: game.player.z + 4 });
    assert(game.player.attack.heavy && !game.player.attack.whirl);
    tick(.1, fps); press('heavy', fps); press('special', fps);
    assert.equal(game.player.pendingAction.key, 'special'); assert.equal(game.player.pendingAction.reason, 'attack');
    tick(.65, fps);
    assert(game.player.attack.whirl, 'A valid early Girdap press survives the whole heavy animation');
    assert.equal(specialStarts(), 1, 'Girdap takes priority over another queued weapon swing');
    assert.equal(game.player.stamina, 57, 'Heavy 8 + Girdap 45, charged once each');
    assert.equal(game.player.pendingAction, null);
    tick(1.5, fps); assert.equal(specialStarts(), 1, 'Substeps cannot replay a single press');

    for (const key of ['special', 'rage']) {
      reset(); game.update(1 / fps, { dodge: true, [key]: true });
      assert.equal(dodgeStarts(), 1); assert.equal(key === 'special' ? specialStarts() : rageStarts(), 0);
      assert.equal(game.player.pendingAction.key, key, 'The skill pressed with Space visibly waits for its newly started roll');
      while (game.player.dodge > 1 / 240) game.update(1 / 240, {});
      game.update(game.player.dodge + .001, {}); assert.equal(game.player.dodge, 0);
      assert.equal(key === 'special' ? specialStarts() : rageStarts(), 0, 'The skill cannot consume stamina before the roll finishes');
      game.update(1 / fps, {}); assert.equal(key === 'special' ? specialStarts() : rageStarts(), 1, 'The first update after roll recovery consumes the retained skill');
      assert.equal(game.player.stamina, 45, 'A simultaneous defensive roll and skill spend 20 + 45 once each');
      assert.equal(game.player.pendingAction, null); tick(.8, fps);
      assert.equal(key === 'special' ? specialStarts() : rageStarts(), 1, 'A simultaneous press cannot replay after the roll');
      reset(); game.debug.setPlayer({ stamina: 60 }); game.update(1 / fps, { dodge: true, [key]: true });
      tick(.65, fps); assert.equal(dodgeStarts(), 1); assert.equal(key === 'special' ? specialStarts() : rageStarts(), 0);
      assert.equal(game.player.lack.key, key); assert.equal(game.player.lack.reason, 'stamina'); assert.equal(game.player.pendingAction, null);
      tick(2, fps); assert.equal(key === 'special' ? specialStarts() : rageStarts(), 0, 'Shared-resource shortage rejects the waiting skill rather than casting after regeneration');
    }

    // Defence does not inherit the heavy swing's .70 s commitment: one Space press cancels it immediately.
    for (const age of [0, .1, .28]) {
      reset(); game.update(1 / fps, { stand: true, clickHeavy: true, pointX: game.player.x, pointZ: game.player.z + 4 });
      if (age) tick(age, fps); assert(game.player.attack.heavy); assert(game.player.attack.age < game.player.attack.strike);
      press('dodge', fps);
      assert.equal(dodgeStarts(), 1, 'Space starts during the same update, even just before heavy contact');
      assert.equal(game.player.attack, null); assert(game.player.invulnerable); assert(game.player.dodge > 0);
      assert.equal(game.player.stamina, 82, 'One heavy 8 and one defensive roll 20 are charged');
      assert.equal(game.player.pendingAction, null); tick(.8, fps); assert.equal(dodgeStarts(), 1, 'A consumed Space press cannot replay');
    }
    reset(); game.update(1 / fps, { stand: true, clickHeavy: true, pointX: game.player.x, pointZ: game.player.z + 4 });
    assert(game.player.attack.heavy); game.update(1 / fps, { dodge: true, special: true, heavy: true });
    assert.equal(dodgeStarts(), 1); assert.equal(specialStarts(), 0, 'Dodge takes priority over skills and queued weapon swings');
    assert.equal(game.player.attack, null); assert.equal(game.player.pendingAction.key, 'special');
    tick(.55, fps); assert.equal(specialStarts(), 1); assert(game.player.attack.whirl);
    assert.equal(game.player.stamina, 37, 'The interrupted swing, roll and delayed skill each spend their own cost once');

    // Repeated discrete presses during one roll merge into one pending defence, never a list of future rolls.
    reset(); press('dodge', fps);
    for (let i = 0; i < 3; i++) press('dodge', fps);
    assert.equal(dodgeStarts(), 1); assert.equal(game.player.pendingAction.key, 'dodge');
    tick(.55, fps); assert.equal(dodgeStarts(), 2, 'An early second Space survives the whole first roll');
    assert.equal(game.player.stamina, 70); tick(1, fps);
    assert.equal(dodgeStarts(), 2, 'Extra presses merge rather than scheduling a third or fourth roll');
    assert.equal(game.player.pendingAction, null);

    reset(); press('dodge', fps); tick(.05, fps); press('special', fps);
    assert.equal(game.player.pendingAction.key, 'special'); assert.equal(game.player.pendingAction.reason, 'dodge');
    tick(.55, fps); assert(game.player.attack.whirl); assert.equal(specialStarts(), 1);

    reset(); press('dodge', fps); tick(.05, fps); press('rage', fps);
    assert.equal(game.player.pendingAction.key, 'rage'); tick(.75, fps);
    assert(game.player.rageTime > 10, 'A ready rage press survives a roll without a separate fury meter');
    assert.equal(rageStarts(), 1);
    assert.equal(game.player.pendingAction, null);

    reset(); game.debug.setPlayer({ hp: 40 }); game.player.stagger = .65; press('heal', fps);
    assert.equal(game.player.pendingAction.key, 'heal'); tick(.7, fps);
    assert.equal(game.player.hp, 104); assert.equal(game.player.flasks, 3);

    reset(); press('special', fps); assert.equal(game.player.lack, null, 'One successful press must not repeat in physics substeps');
    tick(1.5, fps); events.length = 0; press('special', fps);
    assert.equal(game.player.lack.reason, 'cooldown'); assert(game.player.lack.remaining > 6);
    assert(events.some(e => e.name === 'toast' && e.data.text.includes('yeniden hazırlanıyor')));
    assert.equal(game.player.pendingAction, null);
    tick(8, fps); assert.equal(specialStarts(), 0, 'A long cooldown rejects rather than banking a surprise cast');
    game.player.specialCd = .16; press('special', fps); assert.equal(game.player.pendingAction.reason, 'cooldown');
    tick(.3, fps); assert.equal(specialStarts(), 1, 'A press just before readiness is accepted once');

    for (const [key, cost] of [['dodge', 20], ['special', 45], ['rage', 45]]) {
      reset(); game.debug.setPlayer({ stamina: 3 }); press(key, fps);
      assert.equal(game.player.lack.key, key); assert.equal(game.player.lack.reason, 'stamina'); assert.equal(game.player.lack.cost, cost);
      assert(events.some(e => e.name === 'toast' && e.data.text.includes(cost + ' dayanıklılık')));
      assert.equal(game.player.pendingAction, null); tick(2, fps);
      assert.equal(specialStarts(), 0); assert.equal(rageStarts(), 0); assert.equal(events.filter(e => e.name === 'dodge').length, 0);
    }
    for (const [key, cost] of [['light', 4], ['heavy', 8]]) {
      reset(); game.debug.setPlayer({ stamina: 3 }); press(key, fps);
      assert.equal(game.player.lack.key, key); assert.equal(game.player.lack.cost, cost);
      assert(events.some(e => e.name === 'toast' && e.data.text.includes(cost + ' dayanıklılık')));
    }
    reset(); press('heal', fps); assert.equal(game.player.lack.reason, 'full');
    game.debug.setPlayer({ hp: 40, flasks: 0 }); press('heal', fps); assert.equal(game.player.lack.reason, 'empty');
    reset(); press('rage', fps); assert.equal(game.player.stamina, 65); assert(game.player.rageCd > 24 - 1 / fps && game.player.rageCd <= 24);
    tick(.4, fps); assert(game.player.rageTime > 10); assert(game.player.rageCd < 24, 'Cooldown already runs during the buff');
    const firstCd = game.player.rageCd, firstStamina = game.player.stamina; press('rage', fps);
    assert.equal(game.player.lack.reason, 'active'); assert(events.some(e => e.data.text && e.data.text.includes('zaten etkin')));
    assert.equal(rageStarts(), 1); assert.equal(game.player.stamina, firstStamina); assert(game.player.rageCd < firstCd, 'An active press cannot restart the cooldown');
    press('special', fps); assert.equal(specialStarts(), 1); assert.equal(game.player.stamina, 20, 'Both skills draw from the same 110 stamina');
    assert(game.player.specialCd > 8 - 1 / fps && game.player.specialCd <= 8); assert(game.player.rageCd > 23, 'Girdap has an independent cooldown');
    const cdDuringBuff = game.player.rageCd; tick(11.1, fps); assert.equal(game.player.rageTime, 0); assert(game.player.rageCd < cdDuringBuff - 11);
    press('rage', fps); assert.equal(game.player.lack.reason, 'cooldown'); assert.equal(game.player.pendingAction, null);
    assert(events.some(e => e.data.text && e.data.text.includes('Kan Öfkesi yeniden hazırlanıyor')));
    while (game.player.rageCd > .16) game.update(1 / fps, {});
    assert.equal(rageStarts(), 1, 'A rejected long cooldown cannot bank a later cast');
    press('rage', fps); assert.equal(game.player.pendingAction.key, 'rage'); assert.equal(game.player.pendingAction.reason, 'cooldown');
    tick(.3, fps); assert.equal(rageStarts(), 2, 'The final .22 s accepts exactly one new cry'); assert.equal(game.player.lack, null);

    // If two accepted presses compete for the same stamina, only the first cast can spend it.
    reset(); game.debug.setPlayer({ stamina: 60 }); game.update(1 / fps, { rage: true, special: true });
    tick(.5, fps); assert.equal(rageStarts(), 1); assert.equal(specialStarts(), 0); assert.equal(game.player.stamina, 15);
    assert.equal(game.player.lack.key, 'special'); assert.equal(game.player.lack.reason, 'stamina'); assert.equal(game.player.pendingAction, null);

    // A successful button clears only that button's old denial; repeated failures still advance feedback serials.
    for (const key of ['light', 'heavy', 'dodge', 'special', 'rage', 'heal']) {
      reset(); game.debug.setPlayer({ stamina: 0 }); if (key === 'heal') game.debug.setPlayer({ hp: 40, flasks: 0 });
      const input = key === 'light' || key === 'heavy' ? { stand: true, [key === 'heavy' ? 'clickHeavy' : 'clickLight']: true, pointX: game.player.x, pointZ: game.player.z + 4 } : { [key]: true };
      game.update(1 / fps, input); assert.equal(game.player.lack.key, key); const serial = game.player.lack.serial;
      game.update(1 / fps, input); assert(game.player.lack.serial > serial, 'Repeated denials keep distinct serials');
      game.debug.setPlayer({ stamina: 110, flasks: 4 }); game.update(1 / fps, input);
      assert.equal(game.player.lack, null, 'A successful ' + key + ' clears its old denial');
    }
    reset(); game.debug.setPlayer({ stamina: 3 }); press('rage', fps); const previousLack = game.player.lack;
    game.debug.setPlayer({ stamina: 110 }); press('special', fps); assert.equal(game.player.lack, previousLack, 'Another successful button preserves useful feedback');

    // The HUD refreshes every .08 s: it can miss the null between a denied press, a success and a new reason.
    reset(); game.debug.setPlayer({ stamina: 3 }); press('rage', fps); const staminaDenial = game.player.lack;
    assert.equal(staminaDenial.reason, 'stamina'); game.debug.setPlayer({ stamina: 110 }); press('rage', fps); assert.equal(game.player.lack, null);
    press('rage', fps); assert.equal(game.player.lack.reason, 'active'); assert(game.player.lack.serial > staminaDenial.serial,
      'A new denial after a success must have a different serial even when the HUD never saw the cleared state');
    assert.equal(rageStarts(), 1); assert.equal(game.player.stamina, 65);
    reset(); game.debug.setPlayer({ stamina: 3 }); press('rage', fps); assert.equal(game.player.lack.serial, 1, 'A new journey resets feedback state');

    reset(); game.setQuality({ impact: .65 }); press('rage', fps); waitForContactPause(fps);
    assert(game.hitStop > 0, 'Cry creates a real contact pause for the input test'); press('special', fps); tick(.3, fps);
    assert.equal(specialStarts(), 1, 'A Girdap press during hit-stop is kept and applied once');
    reset(); press('rage', fps); waitForContactPause(fps);
    press('dodge', fps); tick(.3, fps);
    assert.equal(dodgeStarts(), 1, 'Space during real cry contact pause is kept and applied once');
    assert(game.player.invulnerable); assert.equal(game.player.stamina, 45); tick(.8, fps); assert.equal(dodgeStarts(), 1);

    // Short light/heavy wound pauses freeze all clocks and keep the press for their first eligible update.
    for (const key of ['dodge', 'rage']) {
      reset(); game.setQuality({ impact: .65 }); game.debug.invincible(false); game.player.specialCd = .5; game.player.stagger = .3;
      const owner = game.enemies[0], elapsed = game.elapsed, enemyCooldown = owner.cooldown;
      game.debug.strike({ damage: key === 'dodge' ? 10 : 30, owner });
      assert.equal(events.find(e => e.name === 'hit').data.hitstop, key === 'dodge' ? .020 : .030, 'Light/heavy wounds use brief 20/30 ms emphasis');
      game.update(.004, { [key]: true });
      assert(game.hitStop > 0); assert.equal(game.elapsed, elapsed); assert.equal(game.player.specialCd, .5);
      assert.equal(game.player.stagger, .3); assert.equal(owner.cooldown, enemyCooldown); assert.equal(game.player.stamina, 110);
      assert.equal(key === 'dodge' ? dodgeStarts() : rageStarts(), 0, 'The held clocks cannot execute the input early');
      game.update(game.hitStop + .004, {});
      assert.equal(key === 'dodge' ? dodgeStarts() : rageStarts(), 1, 'The first update with simulation time consumes the frozen press');
      assert.equal(game.player.stamina, key === 'dodge' ? 90 : 65); tick(.8, fps);
      assert.equal(key === 'dodge' ? dodgeStarts() : rageStarts(), 1, 'A held press is consumed once');
    }
    game.setQuality({ impact: 0 });
    console.log('ABILITIES: ' + fps + ' FPS finite sparse-input roll/queue/priority/resources/cooldown/hit-stop PASS');
  }
  reset(); game.player.stagger = .6; press('special', 120); assert(game.player.pendingAction);
  game.restart(); assert.equal(game.player.pendingAction, null); tick(.8, 120); assert.equal(specialStarts(), 0);
  for (const ending of ['death', 'win']) {
    reset(); game.player.stagger = .6; press('special', 120); game.debug.setPlayer({ stamina: 3 }); press('rage', 120);
    assert.equal(game.player.pendingAction.key, 'special'); assert.equal(game.player.lack.reason, 'stamina');
    if (ending === 'death') { game.debug.invincible(false); game.debug.strike({ damage: 1000 }); }
    else for (const foe of game.enemies) game.debug.damageEnemy(foe.id, 10000);
    assert.equal(game.state, ending === 'death' ? 'dead' : 'won');
    assert.equal(game.player.pendingAction, null, 'An ended fight cannot promise a queued ability');
    assert.equal(game.player.lack, null, 'An ended fight clears obsolete resource feedback');
    tick(.7, 120); assert.equal(specialStarts(), 0); assert.equal(game.player.pendingAction, null);
    if (ending === 'death') game.respawn(); else { game.toTitle(); game.start(); }
    for (const foe of game.enemies) foe.cooldown = 999;
    tick(.8, 120); assert.equal(specialStarts(), 0, 'The previous fight must not cast after death/next journey');
    assert.equal(game.player.lack, null);
  }
  console.log('ABILITIES: death/win clear queued presses and resource feedback PASS');
  game.dispose(); world.dispose();
  console.log('ALL ABILITY INPUT: PASS (real world/combat/models; no WebGL or audio playback)');
})().catch(e => { console.error(e); process.exitCode = 1; });
