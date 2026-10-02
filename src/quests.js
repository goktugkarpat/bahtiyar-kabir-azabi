/* KABİR AZABI — two story objectives per chapter.
   Loaded before gate.js / combat.js. create({root,world,chapter,player,emit,sound,fx,onChange})
   returns {info,restore,snapshot,interact,update,dispose}. info is game.quests:
   entries (two), completed/total/ready, objective, prompt, markers, revision.
   Every accepted interaction is saved by onChange; no XP/loot rewards or kill quotas.
   Props use the world's already decoded scanned materials and are merged at setup.
   There are no lights, runtime material/geometry/texture creation or per-frame arrays. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, PI = Math.PI, RANGE = 2.35;
  var CHAPTERS = {
    1: { title: 'İsimleri Çalınanlar', introduction: 'Cellat yalnız bedenleri zincirlememiş. Ölülerin isimlerini ve yeminlerini de kapıya bağlamış.', quests: [
      { id: 'lost-names', name: 'İsimsizlerin Yemini', description: 'Unutulanların adlarını bul ve sahiplerine geri ver.', steps: [
        { id: 'names', room: 7, dx: -2.6, dz: 2.6, shape: 'tablet', name: 'İsim Levhası', verb: 'İsim levhasını al', objective: 'Unutulanların Mahzeni’nde isim levhasını bul.', story: 'Taşa kazınmış her isim bir mahkûma ait. Son satır henüz boş: Bahtiyar. Levhayı Çürüyen Revir’deki anı taşına götür.' },
        { id: 'memorial', room: 2, dx: 4.2, dz: 3, shape: 'memorial', name: 'Mahkûmların Anı Taşı', verb: 'İsimleri anı taşına yerleştir', objective: 'Çürüyen Revir’de isimleri anı taşına yerleştir.', story: 'İsimler yerlerine dönünce zincirlerin içindeki fısıltı kesiliyor. Celladın ilk bağı çözüldü.' }
      ] },
      { id: 'blood-verdict', name: 'Kanla Yazılan Hüküm', description: 'Adak Salonu’ndaki hükmü tersine çevir: önce Kül, sonra Kan, son olarak Yemin.', steps: [
        { id: 'ash', room: 3, dx: -5.4, dz: 3.4, shape: 'censer', name: 'Kül Çanağı', verb: 'Kül çanağını söndür', objective: 'Adak Salonu’nda ayini boz: Kül → Kan → Yemin.', story: 'Kül çanağı sönüyor. Kazınmış söz ortaya çıktı: “Beden unutulur; kan tanıklık eder.” Sırada Kan Çanağı var.' },
        { id: 'blood', room: 3, dx: 0, dz: -2.5, shape: 'censer', name: 'Kan Çanağı', verb: 'Kan çanağının bağını çöz', objective: 'Adak Salonu’nda ikinci bağı çöz: Kan Çanağı.', story: 'Kan çanağının demir bağı açılıyor. Hükmü bozmak için son taşı çevir: Yemin.' },
        { id: 'oath', room: 3, dx: 5.4, dz: 3.4, shape: 'seal', name: 'Hüküm Mührü', verb: 'Yemin mührünü tersine çevir', objective: 'Adak Salonu’nda Yemin Mührü’nü tersine çevir.', story: 'Kurbanın yemini celladına döndü. Mahkeme kapısının kanla beslenen bağı kırıldı. Yeraltından kıyıya çıkan yolu Cellat koruyor.' }
      ] }
    ] },
    2: { title: 'Denizin Sakladığı', introduction: 'Kıyıdaki ölüler çanın sesiyle uyanıyor. Fener sönmeden önce burada neler olduğunu hatırlayanlar hâlâ köklerin altında.', quests: [
      { id: 'last-voice', name: 'Boğulanların Son Sesi', description: 'Batık Gümrük’te kaybolan çan dilini bul; Son Fener’deki yas çanına geri tak.', steps: [
        { id: 'clapper', room: 7, dx: -2.8, dz: 3, shape: 'relic', name: 'Kırık Çan Dili', verb: 'Kırık çan dilini al', objective: 'Batık Gümrük Avlusu’nda kırık çan dilini bul.', story: 'Çan diline bir fenercinin yemini kazınmış: “Dönenleri değil, dönmeyenleri çağır.” Son Fener’deki küçük yas çanı bunu bekliyor.' },
        { id: 'mourning-bell', room: 5, dx: -4.5, dz: 4, shape: 'bell', name: 'Yas Çanı', verb: 'Çan dilini yerine tak ve çanı çal', objective: 'Son Fener’de çan dilini yas çanına tak.', story: 'Yas çanı ilk kez ölüler için çalıyor. Denizdeki çığlıklar bir an durdu; büyük çanın ilk bağı koptu.' }
      ] },
      { id: 'root-memory', name: 'Kara Kökün Hafızası', completeStory: 'İki hatıra serbest kaldı. Kökler çekilirken taşta aynı arma beliriyor: boş bir tahtın altında yanan ocak. Çancının ikinci bağı çözüldü.', description: 'Kara Ağacın Mezarlığı’ndaki iki mezar kabını aç; köklerin tutsak ettiği hatıraları serbest bırak.', anyOrder: true, steps: [
        { id: 'grave-west', room: 8, dx: -3.7, dz: 2.8, shape: 'urn', name: 'Tuzla Mühürlü Mezar Kabı', verb: 'Tuz mührünü çöz', objective: 'Kara Ağacın Mezarlığı’nda tuzla mühürlü mezar kabını aç.', story: 'Kavanozun içinden su değil, kül dökülüyor. Kıyı halkı boğulmadan önce harabelerdeki krala götürülmüş.' },
        { id: 'grave-east', room: 8, dx: 3.7, dz: -2.8, shape: 'urn', name: 'Kökle Mühürlü Mezar Kabı', verb: 'Kök mührünü çöz', objective: 'Kara Ağacın Mezarlığı’nda kökle mühürlü mezar kabını aç.', story: 'Köklerin tutsak ettiği hatıra serbest. Taşta boş bir tahtın altında yanan ocak beliriyor. Kıyının acısı o ateşe bağlı.' }
      ] }
    ] },
    3: { title: 'Boş Tahtın Altında', introduction: 'Kıyının çanı sustu; fakat ölüleri çağıran ses mağaranın içinden geliyor. Kral kendi adını taşın içine saklamış.', quests: [
      { id: 'kings-name', name: 'Kralın Çalınmış Adı', description: 'Kralların Mezarları’ndaki ad levhasını al ve Çöken Anıt’ın eksik yerine yerleştir.', steps: [
        { id: 'epitaph', room: 3, dx: 3.8, dz: 3.4, shape: 'tablet', name: 'Kazınmış Ad Levhası', verb: 'Kazınmış ad levhasını al', objective: 'Kralların Mezarları’nda kazınmış ad levhasını bul.', story: 'Levhanın arkasında başka bir unvan var: “Ocağın ilk mahkûmu.” Kralın adı anıttan sökülmüş; yerine koymalısın.' },
        { id: 'name-monument', room: 5, dx: -3.5, dz: -1.8, shape: 'memorial', name: 'Kırık Kral Anıtı', verb: 'Ad levhasını anıta yerleştir', objective: 'Çöken Anıt’ta levhayı eksik yuvaya yerleştir.', story: 'Anıt tamamlandı: kral, ocağı yönetmek için kendi adını kurban etmiş. Adı geri dönünce tahtın ilk mührü çatladı.' }
      ] },
      { id: 'cave-breath', name: 'Mağaranın Nefesi', description: 'Kör Kristaller’de yankıyı serbest bırak; Taşın İçindeki Ölüler’de son ses bağını sustur.', steps: [
        { id: 'echo', room: 7, dx: 3.6, dz: 2.7, shape: 'crystal', name: 'Zincirli Yankı', verb: 'Yankının demir bağını aç', objective: 'Kör Kristaller’de zincirli yankıyı serbest bırak.', story: 'Kristalden bir emir değil, bir insan nefesi yükseliyor. Yankı kuzeydeki son ses bağına cevap veriyor.' },
        { id: 'silence', room: 9, dx: -3.4, dz: 2.2, shape: 'seal', name: 'Son Ses Bağı', verb: 'Son ses bağını sustur', objective: 'Taşın İçindeki Ölüler’de son ses bağını sustur.', story: 'Mağara kendi sessizliğine kavuştu. Ses mührü söküldü; tahtın ardındaki merdiven Kızıl Ocak’a iniyor.' }
      ] }
    ] },
    4: { title: 'Zincirlerin Kaynağı', introduction: 'Tapınağın hükmü, kıyının ağıdı, kralın sesi: hepsi bu ocakta dövülmüş. Kapıyı açmak yetmez; kalbi besleyen düzeni de bozmalısın.', quests: [
      { id: 'last-prisoner', name: 'Son Mahkûmun Yemini', description: 'Kömür Mahkûmları’ndaki yemin halkasını al; Zincir Kuyuları’nın vincinde kullan.', steps: [
        { id: 'last-shackle', room: 2, dx: -3.8, dz: 2.6, shape: 'relic', name: 'Son Yemin Halkası', verb: 'Yemin halkasını al', objective: 'Kömür Mahkûmları’nda son yemin halkasını bul.', story: 'Halka elini yakmıyor. Üzerinde mahkûmların ortak yemini var: “Son çıkan, zinciri de kıracak.” Kuyu vincinin kilidine uyuyor.' },
        { id: 'prison-winch', room: 7, dx: 3.8, dz: 2.5, shape: 'winch', name: 'Mahkûm Vinci', verb: 'Halkayı tak ve kuyu zincirlerini bırak', objective: 'Zincir Kuyuları’nda yemin halkasıyla vinci aç.', story: 'Zincirler kuyuya boşalıyor. Artık ocak yeni bir mahkûmun nefesini çekemeyecek. İlk kilit açıldı.' }
      ] },
      { id: 'heart-feeds', name: 'Kalbi Besleyen Ateş', description: 'Önce döküm akışını, sonra cüruf dönüşünü, son olarak ana beslemeyi kapat.', steps: [
        { id: 'casting-feed', room: 5, dx: -3.5, dz: 3.3, shape: 'valve', name: 'Döküm Vanası', verb: 'Döküm akışını kapat', objective: 'Sönen Dökümhane’de döküm vanasını kapat.', story: 'Sıvı demirin sesi azalıyor. Basıncı geri döndüren cüruf hattı hâlâ açık; sıradaki vana Cüruf Meydanı’nda.' },
        { id: 'slag-return', room: 9, dx: 3.6, dz: 2.8, shape: 'valve', name: 'Cüruf Dönüş Vanası', verb: 'Cüruf dönüşünü kapat', objective: 'Cüruf Meydanı’nda dönüş vanasını kapat.', story: 'Geri dönüş sustu. Ana besleme artık güvenle kesilebilir. Son Döküm’deki mühürlü vanaya ulaş.' },
        { id: 'heart-feed', room: 12, dx: -3.6, dz: 2.5, shape: 'valve', name: 'Kalp Besleme Vanası', verb: 'Kalbin ana beslemesini kes', objective: 'Son Döküm’de kalbin ana beslemesini kes.', story: 'Ana besleme kesildi. Kalp artık tutsaklardan beslenemiyor; ama kendi ateşi hâlâ canlı. Bu yolculuğun son zinciri içeride.' }
      ] }
    ] }
  };

  function create(api) {
    var world = api.world, chapter = Math.max(1, Math.min(4, api.chapter || 1));
    var definition = CHAPTERS[chapter], nodes = [], geometry = [], states = [0, 0], disposed = false;
    var info = { chapter: chapter, title: definition.title, introduction: definition.introduction, entries: [], completed: 0, total: 2,
      ready: false, objective: '', prompt: null, markers: [], revision: 0, legacyComplete: false };
    var root = new T.Group(); root.name = 'Hikâye görevleri'; api.root.add(root);
    var materials = world.materials || {};
    var stone = materials.pale || materials.stone || materials.wall || materials.rock;
    var metal = materials.rust || materials.iron || stone;
    var trim = materials.brass || materials.gold || materials.iron || stone;
    var glow = materials.sanctuary || materials.oath || materials.crystalA || materials.lamp || materials.ember || trim;
    var wood = materials.wood || stone;
    var matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(1, 1, 1), rotation = new T.Euler(), quaternion = new T.Quaternion();
    function put(buckets, material, g, x, y, z, rx, ry, rz) {
      if (!material) { g.dispose(); return; }
      var source = g.index ? g.toNonIndexed() : g; if (source !== g) g.dispose();
      position.set(x, y, z); rotation.set(rx || 0, ry || 0, rz || 0); quaternion.setFromEuler(rotation);
      matrix.compose(position, quaternion, scale); source.applyMatrix4(matrix);
      var bucket = buckets.find(function (b) { return b.material === material; });
      if (!bucket) { bucket = { material: material, pieces: [] }; buckets.push(bucket); }
      bucket.pieces.push(source);
    }
    function box(b, m, w, h, d, x, y, z, rx, ry, rz) { put(b, m, new T.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
    function cyl(b, m, r0, r1, h, x, y, z, rx, ry, rz) { put(b, m, new T.CylinderGeometry(r1, r0, h, 12, 1), x, y, z, rx, ry, rz); }
    function ring(b, m, r, tube, x, y, z, rx, ry, rz) { put(b, m, new T.TorusGeometry(r, tube, 5, 20), x, y, z, rx, ry, rz); }
    function merge(buckets, group) {
      for (var b = 0; b < buckets.length; b++) {
        var entry = buckets[b], list = entry.pieces, count = 0, i;
        for (i = 0; i < list.length; i++) count += list[i].attributes.position.count;
        var positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2), colors = new Float32Array(count * 3), offset = 0;
        colors.fill(1);
        for (i = 0; i < list.length; i++) {
          var a = list[i].attributes, n = a.position.count;
          positions.set(a.position.array, offset * 3); normals.set(a.normal.array, offset * 3); uvs.set(a.uv.array, offset * 2);
          offset += n; list[i].dispose();
        }
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(positions, 3)); g.setAttribute('normal', new T.BufferAttribute(normals, 3));
        g.setAttribute('uv', new T.BufferAttribute(uvs, 2)); g.setAttribute('color', new T.BufferAttribute(colors, 3)); g.computeBoundingSphere(); geometry.push(g);
        var mesh = new T.Mesh(g, entry.material); mesh.name = 'Görev nesnesi · ' + (entry.material.name || 'yüzey');
        mesh.castShadow = false; mesh.receiveShadow = entry.material !== glow; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); group.add(mesh);
      }
    }
    function makeProp(node, index) {
      var group = new T.Group(), body = [], detail = [], s = node.shape;
      group.name = node.name; group.position.set(node.x, node.y, node.z); group.matrixAutoUpdate = false; group.updateMatrix(); root.add(group); node.group = group;
      // The low scalloped stone plinth frames the interactable without hiding actors or altering navigation.
      cyl(body, stone, .64, .58, .14, 0, .07, 0); cyl(body, stone, .49, .45, .11, 0, .195, 0);
      ring(body, trim, .47, .025, 0, .255, 0, PI / 2);
      for (var k = 0; k < 6; k++) { var angle = k * PI / 3; box(body, trim, .035, .025, .12, Math.sin(angle) * .49, .155, Math.cos(angle) * .49, 0, angle); }
      var pedestal = body; body = [];
      if (s === 'tablet' || s === 'memorial' || s === 'seal') {
        box(body, stone, .78, s === 'memorial' ? .88 : .62, .28, 0, s === 'memorial' ? .69 : .56, 0, -.13);
        box(body, metal, .83, .06, .31, 0, 1.04, -.05, -.13);
        box(body, trim, .055, .44, .045, -.27, .67, .16, -.13); box(body, trim, .055, .44, .045, .27, .67, .16, -.13);
        for (var row = 0; row < 4; row++) { box(body, trim, row % 2 ? .31 : .41, .023, .032, 0, .46 + row * .105, .17, -.13); }
        ring(detail, glow, .16, .025, 0, .9, .2); box(detail, glow, .025, .25, .022, 0, .9, .23);
      } else if (s === 'censer' || s === 'urn') {
        var points = [new T.Vector2(.17, .26), new T.Vector2(.29, .36), new T.Vector2(.35, .56), new T.Vector2(.27, .76), new T.Vector2(.22, .81), new T.Vector2(.17, .81), new T.Vector2(.21, .7), new T.Vector2(.23, .54)];
        put(body, s === 'urn' ? stone : metal, new T.LatheGeometry(points, 16), 0, 0, 0);
        ring(body, trim, .25, .028, 0, .775, 0, PI / 2); ring(body, trim, .315, .024, 0, .49, 0, PI / 2);
        for (var chain = -1; chain <= 1; chain += 2) { box(body, trim, .025, .45, .025, chain * .3, .47, .06, 0, 0, chain * .13); }
        put(detail, glow, new T.OctahedronGeometry(.14, 0), 0, .78, 0); // small contained ember; no flat light disk
        // The ritual order is also encoded as one, two or three incisions on the front.
        var marks = s === 'censer' ? index % 3 + 1 : 2;
        for (var rune = 0; rune < marks; rune++) box(body, trim, .025, .13, .025, (rune - (marks - 1) / 2) * .085, .54, .328);
      } else if (s === 'bell') {
        for (var side = -1; side <= 1; side += 2) box(body, wood, .13, 1.42, .18, side * .42, .88, 0);
        box(body, wood, 1.04, .14, .2, 0, 1.58, 0); box(body, metal, .06, .25, .06, 0, 1.43, 0);
        put(body, metal, new T.LatheGeometry([new T.Vector2(.33, .56), new T.Vector2(.35, .61), new T.Vector2(.25, .69), new T.Vector2(.17, 1.1), new T.Vector2(.08, 1.2)], 16), 0, 0, 0);
        ring(body, trim, .33, .025, 0, .62, 0, PI / 2); cyl(detail, glow, .045, .045, .36, 0, .79, 0);
      } else if (s === 'valve' || s === 'winch') {
        box(body, stone, .66, .45, .52, 0, .45, 0); cyl(body, metal, .16, .16, .56, 0, .88, 0);
        ring(body, trim, .4, .045, 0, 1.12, .15, .26); cyl(body, metal, .105, .105, .14, 0, 1.12, .15, PI / 2 + .26);
        for (var spoke = 0; spoke < 4; spoke++) { var a = spoke * PI / 2; box(body, metal, .035, .78, .055, 0, 1.12, .15, .26, 0, a); }
        if (s === 'winch') { cyl(body, wood, .2, .2, .86, 0, .57, -.1, 0, 0, PI / 2); for (var link = 0; link < 5; link++) ring(body, metal, .085, .024, .31, .33 + link * .14, .14, link % 2 ? PI / 2 : 0); }
        else { cyl(body, metal, .18, .18, .7, 0, .4, -.18, PI / 2); ring(body, trim, .19, .03, 0, .4, .17); }
        put(detail, glow, new T.OctahedronGeometry(.1, 0), 0, 1.12, .29);
      } else if (s === 'crystal') {
        for (var crystal = -1; crystal <= 1; crystal++) put(body, stone, new T.ConeGeometry(.18, .72, 5), crystal * .22, .61 + (crystal === 0 ? .2 : 0), 0, 0, 0, -crystal * .3);
        ring(body, metal, .31, .036, 0, .57, 0, PI / 2); box(body, metal, .06, .7, .06, 0, .6, .21);
        put(detail, glow, new T.OctahedronGeometry(.17, 0), 0, .98, 0);
      } else {
        box(body, stone, .65, .34, .56, 0, .4, 0); box(body, trim, .69, .045, .59, 0, .59, 0);
        if (chapter === 2) { cyl(body, metal, .06, .05, .48, 0, .74, 0); put(body, trim, new T.SphereGeometry(.12, 12, 8), 0, .53, 0); }
        else { ring(body, metal, .17, .035, 0, .75, .04, .4); box(body, metal, .07, .29, .07, 0, .62, .07, .4); }
        put(detail, glow, new T.OctahedronGeometry(.09, 0), 0, .83, .11);
      }
      var pickup = s === 'tablet' || s === 'relic';
      if (pickup) {
        merge(pedestal, group);
        var payload = new T.Group(); payload.name = 'Alınabilir hatıra'; payload.matrixAutoUpdate = false; payload.updateMatrix(); group.add(payload); merge(body, payload); node.payloadVisual = payload;
      } else { for (var pb = 0; pb < pedestal.length; pb++) { var bucket = body.find(function (b) { return b.material === pedestal[pb].material; }); if (bucket) bucket.pieces.push.apply(bucket.pieces, pedestal[pb].pieces); else body.push(pedestal[pb]); } merge(body, group); }
      var active = new T.Group(); active.name = 'Görev mührü'; active.matrixAutoUpdate = false; active.updateMatrix(); group.add(active); merge(detail, active); node.activeVisual = active;
    }
    function place(step) {
      var room = world.rooms.find(function (r) { return String(r.id) === String(step.room); });
      if (!room) throw new Error('Görev odası bulunamadı: ' + chapter + '/' + step.room);
      var desiredX = room.x + step.dx, desiredZ = room.z + step.dz, best = null, bestDistance = Infinity;
      // Leave room for the full prop + the hero on every side. This tests the actual collision/navigation functions,
      // so decorative blocks cannot conceal the use point. The deterministic search never changes world RNG.
      for (var iz = -5; iz <= 5; iz++) for (var ix = -5; ix <= 5; ix++) {
        var x = desiredX + ix * .7, z = desiredZ + iz * .7, d = ix * ix + iz * iz;
        if (d >= bestDistance || Math.abs(x - room.x) > room.w / 2 - 2 || Math.abs(z - room.z) > room.d / 2 - 2) continue;
        if (world.isWalkable && !world.isWalkable(x, z, 1.35)) continue;
        var overlaps = false;
        for (var n = 0; n < nodes.length; n++) if (Math.hypot(nodes[n].x - x, nodes[n].z - z) < 2.8) { overlaps = true; break; }
        if (overlaps) continue;
        if (world.pathTo && !world.pathTo(world.spawn, { x: x, z: z }, .5).length) continue;
        best = { x: x, z: z }; bestDistance = d;
      }
      if (!best) throw new Error('Görev nesnesine açık yol bulunamadı: ' + chapter + '/' + step.id);
      return best;
    }
    definition.quests.forEach(function (q, qi) {
      var entry = { id: q.id, name: q.name, description: q.description, complete: false, step: 0, steps: q.steps.length, objective: '', target: null };
      info.entries.push(entry);
      q.steps.forEach(function (step, si) {
        var p = place(step), node = Object.assign({}, step, p, { quest: qi, index: si, bit: 1 << si, complete: false, available: false });
        node.y = world.effectHeightAt ? world.effectHeightAt(p.x, p.z, .65) + .018 : .065;
        node.marker = { id: step.id, quest: qi, name: step.name, x: p.x, z: p.z, active: false, complete: false };
        nodes.push(node); info.markers.push(node.marker); makeProp(node, si);
      });
    });
    var prompt = { id: '', text: '', name: '', quest: '', x: 0, z: 0, available: false }, nearNode = null, nextScan = 0, tracked = null;
    function refresh() {
      var completed = 0;
      for (var qi = 0; qi < 2; qi++) {
        var q = definition.quests[qi], entry = info.entries[qi], count = 0, target = null;
        for (var ni = 0; ni < nodes.length; ni++) {
          var node = nodes[ni]; if (node.quest !== qi) continue;
          node.complete = !!(states[qi] & node.bit); if (node.complete) count++;
          node.available = !node.complete && (q.anyOrder || states[qi] === node.bit - 1);
          node.marker.complete = node.complete; node.marker.active = node.available;
          node.activeVisual.visible = node.available;
          if (node.payloadVisual) node.payloadVisual.visible = !node.complete;
          if (!target && node.available) target = node;
        }
        entry.step = count; entry.complete = count === q.steps.length; entry.target = target ? target.marker : null;
        entry.objective = entry.complete ? 'Tamamlandı' : target ? target.objective : q.description;
        if (entry.complete) completed++;
      }
      info.completed = completed; info.ready = completed === 2;
      info.objective = info.ready ? 'İki bağ çözüldü. Açılan kapıdan geç ve bölümün efendisini yen.' : info.entries[0].complete ? info.entries[1].objective : info.entries[0].objective;
      info.revision++; nextScan = 0; scan();
    }
    function scan() {
      var p = api.player, distance = RANGE * RANGE, selected = null, closest = null, closestDistance = Infinity;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i], dx = p.x - node.x, dz = p.z - node.z, d = dx * dx + dz * dz;
        if (node.available && d < closestDistance) { closest = node; closestDistance = d; }
        if (node.complete || d >= distance) continue;
        if (world.hasClearPath && !world.hasClearPath(p.x, p.z, node.x, node.z, .25)) continue;
        selected = node; distance = d;
      }
      // Follow a nearby unfinished thread, rather than send the player past another
      // available task. A substantial distance advantage prevents text flickering
      // between two equally distant goals while walking through their midpoint.
      if (closest) {
        var tx = tracked ? p.x - tracked.x : 0, tz = tracked ? p.z - tracked.z : 0;
        if (!tracked || !tracked.available || closestDistance < (tx * tx + tz * tz) * .64) tracked = closest;
        info.objective = tracked.objective;
      } else tracked = null;
      nearNode = selected;
      if (!selected) { info.prompt = null; return; }
      prompt.id = selected.id; prompt.name = selected.name; prompt.quest = info.entries[selected.quest].name; prompt.x = selected.x; prompt.z = selected.z;
      prompt.available = selected.available;
      prompt.text = selected.available ? selected.verb : 'Önce ' + (info.entries[selected.quest].target ? info.entries[selected.quest].target.name : 'önceki bağı') + ' · ' + selected.name;
      info.prompt = prompt;
    }
    function restore(saved, legacy) {
      states[0] = states[1] = 0; info.legacyComplete = false;
      if (saved && saved.version === 1 && saved.chapter === chapter && Array.isArray(saved.progress)) {
        for (var qi = 0; qi < 2; qi++) {
          var q = definition.quests[qi], max = (1 << q.steps.length) - 1, n = saved.progress[qi];
          if (!Number.isInteger(n) || n < 0 || n > max) continue;
          if (q.anyOrder || (n & (n + 1)) === 0) states[qi] = n;
        }
      } else if (legacy) { states[0] = (1 << definition.quests[0].steps.length) - 1; states[1] = (1 << definition.quests[1].steps.length) - 1; info.legacyComplete = true; }
      refresh();
    }
    function snapshot() { return { version: 1, chapter: chapter, progress: [states[0], states[1]] }; }
    function interact() {
      if (disposed || api.player.dead) return false;
      scan(); var node = nearNode; if (!node) return false;
      if (!node.available) { api.emit('toast', { text: info.entries[node.quest].objective }); return true; }
      states[node.quest] |= node.bit; refresh();
      api.sound('sealOpen', { x: node.x, z: node.z });
      api.fx('parry', { x: node.x, y: node.y + .8, z: node.z });
      if (api.onChange) api.onChange(); // persist before announcing; repeated presses cannot repeat the step
      var q = definition.quests[node.quest];
      api.emit('quest', { id: info.entries[node.quest].id, name: info.entries[node.quest].name, text: info.entries[node.quest].complete && q.completeStory ? q.completeStory : node.story,
        complete: info.entries[node.quest].complete, completed: info.completed, total: 2, step: info.entries[node.quest].step, steps: info.entries[node.quest].steps });
      return true;
    }
    function update(dt) {
      if (disposed) return;
      var p = api.player;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i], visible = Math.abs(p.z - node.z) < 30 && Math.abs(p.x - node.x) < 32;
        if (node.group.visible !== visible) node.group.visible = visible;
      }
      nextScan -= dt; if (nextScan <= 0) { nextScan = .12; scan(); }
    }
    function dispose() { if (disposed) return; disposed = true; root.removeFromParent(); geometry.forEach(function (g) { g.dispose(); }); root.clear(); }
    refresh();
    return { info: info, snapshot: snapshot, restore: restore, interact: interact, update: update, dispose: dispose };
  }
  B.Quests = { VERSION: 1, chapters: CHAPTERS, create: create };
})();
