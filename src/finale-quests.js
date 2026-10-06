/* KABİR AZABI — V: Son Mahkeme. Main verdicts of chapter V (STORY.md: "Dört Efendinin Mührü" + "Selvi").
   Added only when quests.js has not defined chapter V itself (the quests module owns the story text; this is the fallback
   so the final chapter always has its two gate quests). Sites match world.questSites of finale-world.js. */
(function () {
  'use strict';
  var B = window.BABA; if (!B.Quests || !B.Quests.chapters || B.Quests.chapters[5]) return;
  function verdict(title, question, options) { return { title: title, question: question, options: options }; }
  function option(id, name, story, benefit, amount, effect) { return { id: id, name: name, story: story, benefit: benefit, amount: amount, effect: effect }; }
  var ch = B.Quests.chapters[5] = { title: KabirI18n.t('Kara Defter'), introduction: KabirI18n.t('Mürekkep hiç kurumadı. Dört efendinin mühürleri Kara Kadı’nın kürsüsünü ayakta tutuyor; son satır hâlâ boş ve senin adını bekliyor.'), quests: [
    { id: 'four-seals', name: KabirI18n.t('Dört Efendinin Mührü'), description: KabirI18n.t('Efendilerin gölgelerindeki üç mühür kürsüsünü boz. Sıra serbest.'), anyOrder: true,
      completeStory: KabirI18n.t('Üç mühür kırıldı. Kürsünün altındaki zincirler gevşiyor; Kara Kadı artık efendilerinin hükmüne yaslanamaz.'), steps: [
      { id: 'ledger-seal-1', room: 5, dx: -5, dz: 3, shape: 'seal', name: KabirI18n.t('Çancının Mührü'), verb: KabirI18n.t('Çancının mührünü kır'), objective: KabirI18n.t('Çancının Gölgesi’nde mühür kürsüsünü boz.'), story: KabirI18n.t('Mührün altında tuzla silinmiş adlar var. Bahtiyar onları “borç ödendi” diye yazmıştı. Mühür çatlıyor.') },
      { id: 'ledger-seal-2', room: 6, dx: -3, dz: 6, shape: 'seal', name: KabirI18n.t('Kralın Mührü'), verb: KabirI18n.t('Kralın mührünü kır'), objective: KabirI18n.t('Kralın Gölgesi’nde mühür kürsüsünü boz.'), story: KabirI18n.t('Kralın mührü, kendi adını sattığı günün tarihini taşıyor. Kâtipliğin ilk sayfası bu mühürle başlamış.') },
      { id: 'ledger-seal-3', room: 7, dx: -4, dz: 7, shape: 'seal', name: KabirI18n.t('Ocağın Mührü'), verb: KabirI18n.t('Ocağın mührünü kır'), objective: KabirI18n.t('Ocağın Gölgesi’nde mühür kürsüsünü boz.'), story: KabirI18n.t('Mühür hâlâ sıcak. İçinde bir halkanın izi var: Selvi’nin halkası buradan geçmiş.') }
    ] },
    { id: 'selvi', name: KabirI18n.t('Selvi'), description: KabirI18n.t('Kanlı Terazi’nin yanında zincirli kâtibi bul; onu Son Tanıklık taşına götür.'), steps: [
      { id: 'selvi-cell', room: 10, dx: 11, dz: -4.5, shape: 'tablet', name: KabirI18n.t('Zincirli Kâtibin Masası'), verb: KabirI18n.t('Kâtibin zincirini çöz'), objective: KabirI18n.t('Kanlı Terazi’de zincirli kâtibin masasını bul.'), story: KabirI18n.t('Masadaki kâtip başını kaldırıyor. Selvi. Kalemi hâlâ elinde; boş satıra bakıyor. “Adını yazmamı istediler, abi.”') },
      { id: 'selvi-goal', room: 11, dx: 3, dz: 3.5, shape: 'memorial', name: KabirI18n.t('Son Tanıklık Taşı'), verb: KabirI18n.t('Selvi’nin tanıklığını taşa bırak'), objective: KabirI18n.t('Son Tanıklık taşında Selvi’nin tanıklığını bırak.'), story: KabirI18n.t('Selvi’nin sesi taşa kazınıyor. Defter artık onun kalemini tutamaz. Kürsüye giden kapı açılıyor.') }
    ] }
  ] };
  ch.quests[0].verdict = verdict(KabirI18n.t('Kırık mühürler'), KabirI18n.t('Üç mührün kırıntıları elinde. Onları efendilerin ölü adlarıyla birlikte boşluğa mı atacaksın, yoksa Kadı’nın kürsüsüne karşı mı kullanacaksın?'), [
    option('scatter', KabirI18n.t('Mühürleri boşluğa bırak'), KabirI18n.t('Kırıntılar boşluğa düşüyor. Efendilerin hükmü kimsenin elinde kalmıyor; omzundaki yük hafifliyor.'), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('wield', KabirI18n.t('Mühürleri Kadı’ya karşı taşı'), KabirI18n.t('Kırık mühürler avucunda kızarıyor. Kadı’nın bastığı her hüküm şimdi ona geri dönecek.'), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  ch.quests[1].verdict = verdict(KabirI18n.t('Selvi’nin kalemi'), KabirI18n.t('Selvi kalemi sana uzatıyor. Kalemi kırıp onu Defter’den tamamen kurtarmak mı, kalemi saklayıp son satıra senin karar vermeni mi?'), [
    option('break-quill', KabirI18n.t('Kalemi kır'), KabirI18n.t('Kalem ikiye ayrılıyor. Selvi’nin parmaklarındaki mürekkep siliniyor; nefesin derinleşiyor.'), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('keep-quill', KabirI18n.t('Kalemi sakla'), KabirI18n.t('Kalemi kemerine sokuyorsun. Selvi’nin son duası yaralarını kapatacak; son satırın sahibi artık sensin.'), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
}());
