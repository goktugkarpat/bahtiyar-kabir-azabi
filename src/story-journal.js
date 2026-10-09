/* KABİR AZABI — earned campaign recap. Reads existing quest/profile ledgers; never writes a save. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const pick = (tr, en) => window.KabirI18n && KabirI18n.lang === 'en' ? en : tr;
  const DATA = [
  null,
  {
    "title": [
      "Kurban Tapınağı",
      "Temple of Sacrifice"
    ],
    "opening": [
      "Seni ölü sanıp Kurban Tapınağı'nın kuyusuna attılar. Yirmi yıl Kara Defter'e ad yazan elin şimdi toprağı kazıyor; hükmettiğin insanlar Cellat'ın kapısına bağlanmış.",
      "They thought you dead and threw you into the well of the Temple of Sacrifice. The hand that wrote names in the Black Ledger for twenty years now claws at the earth; the people you condemned are bound to the Executioner's gate."
    ],
    "goal": [
      "Mahkûmlara adlarını geri ver ve tapınağın kan hükmünü boz. Cellat'ın kapısını aş; seni mezara gönderen hükmün izini bul.",
      "Return the prisoners' names and break the temple's blood sentence. Get past the Executioner's gate and follow the order that sent you to the grave."
    ],
    "closing": [
      "Cellat'ın bıçağı sustu; yazdığın isimlerin acısı silinmedi. Son sözünde ortaklığınızı kabul etti: adları sen yazdın, bedenleri o kesti. Ölüleri birbirine bağlayan sicilin yolu Kara Kıyı'ya açılıyor.",
      "The Executioner's blade is silent; the pain of the names you wrote is not erased. In his last words he confessed your partnership: you wrote the names, he cut the bodies. The register that binds the dead leads to the Black Shore."
    ],
    "voiceStart": "intro",
    "voiceEnd": "truth1"
  },
  {
    "title": [
      "Kara Kıyı",
      "Black Shore"
    ],
    "opening": [
      "Defter'e 'borç ödendi' diye kaydettiğin kıyıdasın. Çan, boğulanları her defasında son nefeslerine döndürüyor; kız kardeşin Selvi'nin sevk kaydı bu insanların arasından geçiyor.",
      "You stand on the shore you recorded as 'debt paid.' Each toll returns the drowned to their final breath; your sister Selvi's delivery record passes through the same account."
    ],
    "goal": [
      "Yas çanının ve mezar köklerinin bağlarını çöz. Çancı'nın hesabından Selvi'nin nereye götürüldüğünü öğren.",
      "Break the bonds of the mourning bell and the burial roots. Learn from the Bellringer's account where Selvi was taken."
    ],
    "closing": [
      "Selvi boğulmadı. Çancı onu krala verdiğini itiraf etti; kardeşin kıyının borcuna karşılık sayılmış. Kendi imzanın izini, harabelerdeki tahta kadar sürmelisin.",
      "Selvi did not drown. The Bellringer confessed that he gave her to the King; your sister was counted against the shore's debt. You must follow your own signature as far as the throne in the ruins."
    ],
    "voiceStart": "coastIntro",
    "voiceEnd": "truth2"
  },
  {
    "title": [
      "Sessiz Taht",
      "Silent Throne"
    ],
    "opening": [
      "Kralın emirleri taşın içine kapatılmış insanların nefesinden çıkıyor. Sana kalemi veren kral kendi adını sakladı; Selvi'ye ulaşan yol onun unvanının ardında.",
      "The King's commands issue from the breaths of people sealed within the stone. The King who gave you the pen hid his own name; the path to Selvi lies behind his title."
    ],
    "goal": [
      "Kralın sakladığı adı ortaya çıkar ve mağaranın ses bağlarını çöz. Tahtı aşarak Kara Defter'in gerçek sahibini bul.",
      "Uncover the King's hidden name and break the cave's bonds of sound. Get beyond the throne and find the true owner of the Black Ledger."
    ],
    "closing": [
      "Kral tahtını korumak için kendi adını sattı. Onu devirmek sicili kapatmadı: Defter Kara Kadı'nın. Tahtın arkasındaki yol, yazdığın adların halkalara dövüldüğü Kızıl Ocak'a iniyor.",
      "The King sold his name to preserve his throne. His fall did not close the register: the Ledger belongs to the Black Judge. The path behind the throne descends into the Crimson Furnace, where the names you wrote are forged into links."
    ],
    "voiceStart": "ruinsIntro",
    "voiceEnd": "truth3"
  },
  {
    "title": [
      "Kızıl Ocak",
      "Crimson Furnace"
    ],
    "opening": [
      "Tapınağın hükmünü, kıyının boğulmasını ve kralın emrini besleyen düzenin kalbindesin. Yazdığın her ad burada bitmeyen bir ateş gününe çevrildi; Selvi'nin halkasını arıyorsun.",
      "You stand at the heart of the order that fed the temple's sentence, the shore's drowning and the King's command. Every name you wrote became an endless day of fire here; you seek Selvi's link."
    ],
    "goal": [
      "Mahkûmların kuyu zincirlerini ve kalbin insan beslemesini kes. Ocağı aş; Selvi'nin halkasına ne olduğunu öğren.",
      "Sever the prisoners' well chains and the human feed into the heart. Get past the furnace and learn what became of Selvi's link."
    ],
    "closing": [
      "Selvi'nin halkası boş: o yanmadı. Kara Kadı onu yeni yazı masasına bağlamış. Ateşi söndürdün, fakat sicil hâlâ yazılıyor; kardeşini bulmak için mürekkebin kaynağına gitmelisin.",
      "Selvi's link is empty: she did not burn. The Black Judge chained her to a new writing desk. You silenced the fire, but the register is still being written; to find your sister, you must reach the source of the ink."
    ],
    "voiceStart": "forgeIntro",
    "voiceEnd": "truth4"
  },
  {
    "title": [
      "Son Mahkeme",
      "Last Court"
    ],
    "opening": [
      "Selvi senin el yazını taklit ederek Kara Defter'i doldurmaya zorlanıyor. Kadı, bir kâtibin yerine başkasını bağladı; kardeşini kurtarırken onun yerine geçmeni bekliyor.",
      "Selvi is forced to fill the Black Ledger by copying your handwriting. The Judge chained one scribe in another's place; he expects you to take her seat when you rescue her."
    ],
    "goal": [
      "Üç efendi mührüyle Defter'in kilidini aç, Selvi'nin zincirini çöz ve Kara Kadı'yı yen. Son satırda kimin bedel ödeyeceğine karar ver.",
      "Open the Ledger's lock with the three masters' seals, break Selvi's chain and defeat the Black Judge. Decide who pays the price on the last line."
    ],
    "closing": [
      "Kara Kadı düştü. Öldürmen yazdıklarını silmedi. Sicili kendi adınla kapatabilir, adların hafızasını ateşe verebilir ya da Selvi'yi silip kalemi devralabilirsin. Son hükmün bedelini saklayacak bir mühür kalmadı.",
      "The Black Judge has fallen. Killing him did not erase what you wrote. Close the register with your own name, burn the names' memories, or erase Selvi and take the pen. No seal remains to hide the cost of your last sentence."
    ],
    "voiceStart": "ch5Intro",
    "voiceEnd": null
  }
];
  function chapter(ch) {
    const d = DATA[ch]; if (!d) return null;
    return { chapter: ch, title: pick(...d.title), opening: pick(...d.opening), goal: pick(...d.goal), closing: pick(...d.closing), voiceStart: d.voiceStart, voiceEnd: d.voiceEnd };
  }
  function currentChapter(game) {
    const p = game && game.progression, q = game && game.quests;
    const n = q && q.chapter || p && p.chapter || 1;
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
  }
  function currentGoal(game) { return chapter(currentChapter(game)).goal; }
  function entries(game) {
    const p = game && game.progression, q = game && game.quests;
    if (!p) return [];
    const current = currentChapter(game), completed = new Set((Array.isArray(p.completed) ? p.completed : []).filter(ch => Number.isInteger(ch) && ch >= 1 && ch <= current));
    const claimed = new Set(p.boons && typeof p.boons === 'function' ? p.boons().claimed || [] : []);
    const allowed = Array.from(new Set([current, ...completed])).sort((a, b) => a - b);
    return allowed.map(ch => {
      const d = chapter(ch), def = B.Quests && B.Quests.chapters[ch], local = q && q.chapter === ch ? q : null;
      const lines = window.KabirI18n && KabirI18n.lang === 'en' ? B.NarrationEN : B.Narration;
      const narration = [], seenNarration = new Set();
      for (const [key, title] of [[d.voiceStart, pick('Bölüm başlangıcı', 'Chapter opening')], ['story' + ch, pick('Hatıra', 'Recollection')]]) {
        const text = lines && lines[key] && lines[key].text;
        if (typeof text === 'string' && text.trim() && !seenNarration.has(text.trim())) { seenNarration.add(text.trim()); narration.push({ key, title, text }); }
      }
      const side = B.QuestSide && B.QuestSide.chapters[ch] || [], pagesDef = side.find(e => e.kind === 'lore'), pageEntry = local && (local.side || []).find(e => pagesDef && e.id === pagesDef.id);
      const pages = [];
      if (pagesDef) pagesDef.pages.forEach((pg, i) => {
        const found = claimed.has('c' + ch + ':' + pagesDef.id) || claimed.has('c' + ch + ':read:' + pg.site) || !!(pageEntry && pageEntry.pages && pageEntry.pages[i] && pageEntry.pages[i].found);
        if (found) pages.push({ id: pg.site, title: pg.name, text: pg.text });
      });
      const discoveries = [], decisions = [];
      if (local && def) def.quests.forEach((source, index) => {
        const entry = local.entries && local.entries[index];
        (local.markers || []).filter(m => m.quest === index && m.complete).forEach(m => {
          const step = source.steps.find(s => s.id === m.id) || (source.trial && source.trial.id === m.id ? source.trial : null);
          if (step && step.story) discoveries.push({ id: step.id, title: step.name, text: step.story });
        });
        if (entry && entry.choice && entry.outcome) decisions.push({ id: source.id, title: entry.name, text: entry.outcome });
      });
      // The chapter gate requires every authored main step before its boss.
      // Completed chapters therefore retain those earned clues after transition;
      // selecting a chapter alone grants none, and optional trials are excluded.
      if (!local && completed.has(ch) && def) def.quests.forEach(source => {
        source.steps.forEach(step => {
          if (step.story) discoveries.push({ id: step.id, title: step.name, text: step.story });
        });
      });
      if (def) def.quests.forEach(source => {
        if (decisions.some(e => e.id === source.id)) return;
        const opt = source.verdict && source.verdict.options.find(o => claimed.has('c' + ch + ':verdict:' + source.id + ':' + o.id));
        if (opt) decisions.push({ id: source.id, title: source.name + ' · ' + opt.name, text: opt.story });
      });
      const learnedPages = pagesDef && claimed.has('c' + ch + ':' + pagesDef.id) ? pagesDef.story : '';
      let ending = null;
      if (ch === 5 && B.QuestSide && B.QuestSide.finale) {
        const resolved = B.QuestSide.resolveEnding && B.QuestSide.resolveEnding(Array.from(claimed), local && local.finale && local.finale.id);
        const fin = B.QuestSide.finale.options.find(o => B.QuestSide.resolveEnding ? o.id === resolved : claimed.has('c5:finale:' + o.id));
        if (fin) ending = { id: fin.id, title: fin.name, text: fin.story };
        else if (local && local.finale) ending = { id: local.finale.id, title: local.finale.name, text: local.finale.story };
      }
      if (ending && B.QuestSide.endingReflection) ending.reflection = B.QuestSide.endingReflection(ending.id, Array.from(claimed));
      return { ...d, current: ch === current, completed: completed.has(ch), closing: completed.has(ch) ? d.closing : '', pages, learnedPages, discoveries, decisions, ending, narration };
    });
  }
  B.StoryJournal = Object.freeze({ chapter, entries, currentGoal });
})();
