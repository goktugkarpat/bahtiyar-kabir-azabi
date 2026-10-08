/* KABİR AZABI — earned campaign recap. Reads existing quest/profile ledgers; never writes a save. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const pick = (tr, en) => window.KabirI18n && KabirI18n.lang === 'en' ? en : tr;
  const DATA = [null,
    {
      title: ['Kurban Tapınağı', 'Temple of Sacrifice'],
      opening: ['Seni ölü sanıp tapınağın kuyusuna attılar. Yirmi yıl Kara Defter’e yazdığın adların zincirleri arasında uyanıyorsun; Cellat bu adları kendi kapısına bağlamış.', 'They thought you dead and threw you into the temple well. You wake among the chains of the names you wrote in the Black Ledger for twenty years; the Executioner has bound those names to his gate.'],
      goal: ['Mahkûmların bağlarını çöz. Cellat’ı aşarak buradan çık ve seni buraya getiren hükmün izini bul.', 'Break the prisoners’ bonds. Get past the Executioner and out of the temple, and follow the sentence that brought you here.'],
      closing: ['Cellat’ın son sözü geçmişteki payını açığa çıkarıyor: adları sen yazdın, bedenleri o kesti. Defter’deki imzan bu zincirlerin başlangıcıydı.', 'The Executioner’s last words reveal your part in the past: you wrote the names, and he cut the bodies. Your signature in the Ledger was where these chains began.'],
      voiceStart: 'intro', voiceEnd: 'truth1'
    },
    {
      title: ['Kara Kıyı', 'Black Shore'],
      opening: ['Burası Defter’e “borç ödendi” diye kaydettiğin kıyı. Ölüler çanın sesiyle uyanıyor; kız kardeşin Selvi’nin izi de buradan geçiyor.', 'This is the shore you recorded as “debt paid” in the Ledger. The dead wake to the bell, and your sister Selvi’s trail passes through here.'],
      goal: ['Çancının ölüler üzerindeki bağlarını çöz. Selvi’nin kıyıdan nereye götürüldüğünü öğren.', 'Break the Bellringer’s hold on the dead. Learn where Selvi was taken from this shore.'],
      closing: ['Selvi boğulmadı. Çancı onu krala sattığını itiraf etti; kardeşinin izi kıyıdan harabelerdeki tahta uzanıyor.', 'Selvi did not drown. The Bellringer confessed that he sold her to the King; your sister’s trail leads from the shore to the throne in the ruins.'],
      voiceStart: 'coastIntro', voiceEnd: 'truth2'
    },
    {
      title: ['Sessiz Taht', 'Silent Throne'],
      opening: ['Sana kalemi veren kral kendi adını taşın içine saklamış. Onun tahtına doğru ilerlerken, Defter’in yalnız kralın elinde olmadığını araştırıyorsun.', 'The king who handed you the pen hid his own name within the stone. As you approach his throne, you seek the hand behind the Ledger.'],
      goal: ['Kralın gizlediği adını ortaya çıkar ve mağaranın ses bağlarını çöz. Selvi’nin izini sürerken Defter’in gerçek sahibini öğren.', 'Uncover the King’s hidden name and break the cave’s bonds of sound. Follow Selvi’s trail and learn who truly owns the Ledger.'],
      closing: ['Kral da kendi adını tahtı karşılığında satmış bir mahkûmdu. Defter’i tutan asıl el Kara Kadı’nın; tahtın ardındaki yol zincirlerin dövüldüğü ocağa iniyor.', 'The King was another prisoner who sold his name for a throne. The Black Judge is the true hand behind the Ledger; the path beyond the throne descends into the furnace where the chains are forged.'],
      voiceStart: 'ruinsIntro', voiceEnd: 'truth3'
    },
    {
      title: ['Kızıl Ocak', 'Crimson Furnace'],
      opening: ['Defter’e yazdığın her ad burada bir halkaya döndü. Tapınağın hükmünü, kıyının ağıdını ve kralın sesini besleyen düzenin kalbindesin.', 'Every name you wrote in the Ledger became a link here. You stand at the heart of the order that fed the temple’s sentence, the shore’s lament and the King’s voice.'],
      goal: ['Mahkûmları ocağa bağlayan zincirleri ve kalbin beslemesini kes. Ocağı aş ve Selvi’nin halkasının izini bul.', 'Sever the chains that bind the prisoners to the furnace and cut off the heart’s feed. Get past the furnace and find the trail of Selvi’s link.'],
      closing: ['Küllerde Selvi’nin adı yazılı bir halka var, fakat içi boş: o yanmadı. Ocağın arkasında hâlâ yazılan hükümlere ve kardeşine giden yol açıldı.', 'A link bearing Selvi’s name lies in the ashes, but it is empty: she did not burn. Beyond the furnace lies the road to the sentences still being written, and to your sister.'],
      voiceStart: 'forgeIntro', voiceEnd: 'truth4'
    },
    {
      title: ['Son Mahkeme', 'Last Court'],
      opening: ['Kara Kadı, Selvi’yi yeni kâtibi yapmış. Bir zamanlar senin tuttuğun kalemi şimdi kardeşin tutuyor; Defter’in son satırı ise senin adını bekliyor.', 'The Black Judge has made Selvi his new scribe. Your sister now holds the pen you once held, while the Ledger’s last line waits for your name.'],
      goal: ['Efendilerin mühürleriyle Defter’in kilidini aç. Selvi’yi kurtar, Kara Kadı’yla yüzleş ve son satırın ne olacağına karar ver.', 'Unlock the Ledger with the masters’ seals. Free Selvi, confront the Black Judge and decide what becomes of the last line.'],
      closing: ['Kara Kadı düştü. Defter ve kalem senin önünde; son hüküm artık senin kararın.', 'The Black Judge has fallen. The Ledger and the pen lie before you; the last verdict is yours.'],
      voiceStart: 'ch5Intro', voiceEnd: null
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
      if (def) def.quests.forEach(source => {
        if (decisions.some(e => e.id === source.id)) return;
        const opt = source.verdict && source.verdict.options.find(o => claimed.has('c' + ch + ':verdict:' + source.id + ':' + o.id));
        if (opt) decisions.push({ id: source.id, title: source.name + ' · ' + opt.name, text: opt.story });
      });
      const learnedPages = pagesDef && claimed.has('c' + ch + ':' + pagesDef.id) ? pagesDef.story : '';
      let ending = null;
      if (ch === 5 && B.QuestSide && B.QuestSide.finale) {
        const fin = B.QuestSide.finale.options.find(o => claimed.has('c5:finale:' + o.id));
        if (fin) ending = { title: fin.name, text: fin.story };
        else if (local && local.finale) ending = { title: local.finale.name, text: local.finale.story };
      }
      return { ...d, current: ch === current, completed: completed.has(ch), closing: completed.has(ch) ? d.closing : '', pages, learnedPages, discoveries, decisions, ending, narration };
    });
  }
  B.StoryJournal = Object.freeze({ chapter, entries, currentGoal });
})();
