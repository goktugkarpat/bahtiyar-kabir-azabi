/* KABİR AZABI — earned campaign recap. Reads existing quest/profile ledgers; never writes a save. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const pick = (tr, en) => window.KabirI18n && KabirI18n.lang === 'en' ? en : tr;
  const DATA = [
  null,
  {
    "title": [
      "Mezara Sığmayan",
      "The Unburied"
    ],
    "opening": [
      "Seni yaralı ele geçirdiler. Kara Kadı’nın emriyle canlı gömdüler. Taş kapak kırıldı; şimdi çıkış yolunu bul.",
      "They captured you wounded and buried you alive on the Black Judge’s orders. The stone lid has broken. Find your way out."
    ],
    "goal": [
      "Gardiyanların sakladığı kilit levhasını bul ve hücre düzeneğini aç. Esirlerin tutulduğu ayinin iki bağını kır.",
      "Find the lock plate hidden by the wardens and release the cells. Break the two ritual bonds holding the captives."
    ],
    "closing": [
      "Gardiyan düştü. Kara Kadı’nın emri cebinde; tutsakların gösterdiği yol kıyıya çıkıyor.",
      "The warden falls. You carry the Black Judge’s order; the captives’ passage leads to the shore."
    ],
    "voiceStart": "intro",
    "voiceEnd": "truth1"
  },
  {
    "title": [
      "Esir Limanı",
      "Port of Captives"
    ],
    "opening": [
      "Kara Kadı’nın kurbanları bu limandan taşınıyor. Esirleri çıkar, sevkiyatı durdur ve harabelere giden yolu bul.",
      "The Black Judge’s sacrifices pass through this port. Free the captives, stop the shipment and find the road to the ruins."
    ],
    "goal": [
      "Sevkiyat çanının dilini bul; geminin esir kilitlerini aç. Mezarlıkta gizlenen iki sevkiyat bağını kır.",
      "Find the shipment bell’s clapper and unlock the captive hold. Break the two shipment bonds hidden in the cemetery."
    ],
    "closing": [
      "Esir gemisi boş. Sevkiyat durdu. Kadı’nın izini harabelerin altında süreceksin.",
      "The captive ship is empty. The shipment has stopped. Follow the Judge’s trail beneath the ruins."
    ],
    "voiceStart": "coastIntro",
    "voiceEnd": "truth2"
  },
  {
    "title": [
      "Toprağın Tutsakları",
      "Prisoners of the Earth"
    ],
    "opening": [
      "Kadı’nın eski kurbanları taşın içinde tutuluyor. Bağlarını kır; ocağa inen geçidi aç.",
      "The Judge’s old victims are held within the stone. Break their bonds and open the passage to the forge."
    ],
    "goal": [
      "Kurbanların bağ levhasını bul ve taş kilidine yerleştir. Mağaradaki iki geçit bağını çöz.",
      "Find the victims’ bond plate and fit it into the stone lock. Release the cavern’s two passage bonds."
    ],
    "closing": [
      "Kurban Bekçisi düştü. Taş hücreler açıldı; sıcak merdiven ocağa iniyor.",
      "The Sacrifice Warden falls. The stone cells open; the warm stairs descend to the forge."
    ],
    "voiceStart": "ruinsIntro",
    "voiceEnd": "truth3"
  },
  {
    "title": [
      "Zincirlerin Kaynağı",
      "Source of the Chains"
    ],
    "opening": [
      "Kadı’nın gardiyanları burada silahlanıyor. Esir işçileri çıkar; zincir üretimini durdur.",
      "The Judge’s wardens are armed here. Free the captive workers and stop the forging of chains."
    ],
    "goal": [
      "Vinç anahtarını bul ve işçilerin zincirlerini bırak. Dökümü durdur ve mahkeme kapısının beslemesini kes.",
      "Find the winch key and release the workers’ chains. Stop the casting and cut the court gate’s feed."
    ],
    "closing": [
      "Ocak sustu. Esir işçiler çıktı. Son Mahkeme’nin kapısı açık.",
      "The forge falls silent. The captive workers are out. The Last Court’s gate stands open."
    ],
    "voiceStart": "forgeIntro",
    "voiceEnd": "truth4"
  },
  {
    "title": [
      "Son Mahkeme",
      "The Last Court"
    ],
    "opening": [
      "Kadı seni yeniden zincirlemek istiyor. Son esirleri çıkar, kurban bağlarını kır ve hesabı kapat.",
      "The Judge means to chain you again. Free the last captives, break the tribute bonds and settle the score."
    ],
    "goal": [
      "Kadının kürsüsünü besleyen üç kurban bağını kır. Arşivin derinliklerindeki son esirlerin kilidini aç.",
      "Break the three tribute bonds feeding the Judge’s dais. Open the lock holding the last captives deep in the archive."
    ],
    "closing": [
      "Kara Kadı öldü. Kurban zincirleri kırıldı. Bahtiyar ve esirler gün ışığına çıktı.",
      "The Black Judge is dead. The tribute chains are broken. Bahtiyar and the captives walk into daylight."
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
      for (const [key, title] of [[d.voiceStart, pick('Bölüm başlangıcı', 'Chapter opening')], ['story' + ch, pick('Keşif', 'Discovery')]]) {
        if (key === 'story' + ch && !completed.has(ch) && !(local && local.discoverySeen)) continue;
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
