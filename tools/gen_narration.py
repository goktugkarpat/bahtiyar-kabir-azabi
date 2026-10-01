#!/usr/bin/env python3
"""KARA GEÇİT - gömülü ses üreticisi (anlatıcı + efekt bankası).

src/narration.js dosyasını yeniden üretir. İçinde iki gömülü veri vardır:
  window.BABA.Narration  - anlatıcı cümleleri (metin, süre, base64 MP3)
  window.BABA.SoundBank  - CC0 ses paketlerinden işlenmiş kısa efektler ve
                           tarikatçı ilahileri (base64 MP3)
Oyun dosyadan (file://) açıldığı için ses harici dosya olarak yüklenmez.

Kullanım (proje kökünden):
  python3 tools/gen_narration.py          # anlatıcı + efektler
  python3 tools/gen_narration.py voice    # yalnızca anlatıcı
  python3 tools/gen_narration.py sfx      # yalnızca efekt bankası
  python3 tools/gen_narration.py ambient  # yalnızca kayıtlı insan çığlıkları
  python3 tools/gen_narration.py voice --only intro,boss   # seçili cümleler
  python3 tools/gen_narration.py voice --samples DIR   # 3 stil x aynı 4 cümle -> voice_A/B/C.mp3
  python3 tools/gen_narration.py --wav DIR # işlenmiş sesleri ayrıca WAV yaz (kontrol için)

Gerekenler: Python 3.9+, `pip install edge-tts`, ffmpeg + ffprobe
(librubberband ve libmp3lame ile; Homebrew ve gyan.dev derlemelerinde vardır).
İndirilen paketler ve TTS kayıtları proje dışında önbelleğe alınır:
  $KARA_AUDIO_CACHE  ya da  ~/.cache/kara-gecit-audio
Anlatıcı sesi: edge-tts tr-TR-AhmetNeural. Varsayılan D stili bütün düşünceyi tek kayıtta seslendirir:
doğal Türkçe vurgu ve sözcük geçişleri korunur; tempo -8%, perde yalnız -3 Hz. Durakları noktalama ve
cümle anlamı belirler. Baş/son sessizliği kırpılır; hafif göğüs EQ'su, sibilans denetimi ve düşük oranlı
sıkıştırma uygulanır; -16 LUFS, 32 kHz/96 kbps. Konuşmaya yankı eklenmez.
Formant düşürme, yapay fısıltı ve her cümlenin sonunu ayrıca yavaşlatma kullanılmaz. Bahtiyar (H) ve
Zincir Celladı (E) aynı sesi hafif tempo/ton farkıyla kullanır; farklı gerçek oyuncularmış gibi sunulmaz.
Eski N/A/B/C işleme adayları karşılaştırma için korunur. `voice --style D|N|A|B|C` anlatıcı stilini seçer;
karakter cümleleri kendi H/E stillerinde üretilir. `voice --samples DIR` örnekleri üretir.
Efekt kaynaklarının hepsi CC0'dır (liste ve değişiklikler: ASSET-LICENSES.md). Her sprite'ın
başında bir eşitleme tonu vardır (MARK_AT); audio.js MP3 çözücü gecikmesini buna göre düzeltir.
İşkence ortamındaki insan sesleri HaelDB'nin CC0 oyuncu kayıtlarından işlenir. Bunlar rol yapılarak
kaydedilmiş çığlık ve zorlanmalardır. `ambient` mevcut darbe bankasını koruyarak bunları yeniler.
Metni değiştirilen bir cümle için: LINES içinde düzelt, sonra `voice --only anahtar` çalıştır.
Taşınabilir araç yolları KABIR_FFMPEG/KABIR_FFPROBE ile verilebilir; ffprobe yoksa ffmpeg ölçer.
"""
import array, asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, tempfile, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_JS = os.path.join(ROOT, 'src', 'narration.js')
CACHE = os.environ.get('KARA_AUDIO_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', 'kara-gecit-audio')
VOICE = 'tr-TR-AhmetNeural'
FFMPEG = os.environ.get('KABIR_FFMPEG') or shutil.which('ffmpeg') or 'ffmpeg'
FFPROBE = os.environ.get('KABIR_FFPROBE') or shutil.which('ffprobe')

# ---------------------------------------------------------------------------
# Anlatıcı cümleleri. Anahtarlar app.js / audio.js tarafından çağrılır:
#   intro: oyun başı (Kül Eşiği)          chains: Zincir Avlusu (oda 1)
#   ritual: Çürüyen Revir (oda 2)         crypt: Adak Salonu (oda 3)
#   rot: Kemik Geçidi (oda 4)             checkpoint: Sessiz Şapel / yemin taşı
#   boss: Zincir Mahkemesi / cellat       seal: ilk mühür açılınca (audio.js)
#   death, death2, death3: ölüm ekranı (sırayla)   win: bölüm sonu
#   ruinsIntro/Checkpoint/Boss/Win: Sessiz Taht (III), forgeIntro/Checkpoint/Boss/Win: Kızıl Ocak (IV)
# Yeni konuşma çatışmada başlamaz; başlamış cümle, oda değişse de tamamlanır.
# ---------------------------------------------------------------------------
LINES = {
    'ruinsIntro': 'Kıyının ardında bir krallık gömülü. Kül harabelerinde duran taşlar bile ölülerin adını taşıyor. Yol, yıkılmış anıtın altından mağaraya iniyor... Orada hâlâ bir kral bekliyor.',
    'ruinsCheckpoint': 'Son Yemin taşı seni hatırlayacak. Canını tazele. Tahtın nöbetini aşınca geri dönecek bir yol bulamayabilirsin.',
    'ruinsBoss': 'Oyukların kralı. Tacının altında bir yüz yok; yalnızca aç bir boşluk var. Tahtında oturan şeyi sustur. Yoksa bu mağara senin sesinle konuşacak.',
    'ruinsWin': 'Taht parçalandı... Ama kralın altında bir kapı açıldı. İçeriden gün ışığı değil, kızgın demirin soluğu geliyor. Celladın zincirleri orada dövülmüş.',
    'forgeIntro': 'Bu ocak yıllar önce unutuldu. Körükler hâlâ çalışıyor; ateşi besleyenler çoktan kül oldu. Celladın zincirleri burada dövülüyor. Kaynağı yok etmeden bu yemin bitmeyecek.',
    'forgeCheckpoint': 'Köz Yemini mühürlendi. Son Döküm’e giden yol açık. Canını tazele... Ocağın kalbi hâlâ atıyor ve buraya kadar taşıdığın bütün yaraları istiyor.',
    'forgeBoss': 'Ocağın kalbi. Demir halkaların içinde tutsak bir alev... Zincirleri yeniden dövmek için senin kanını bekliyor. Bu ateşi söndür.',
    'forgeWin': 'Ocak sustu... Son zincir de eridi. Geride bıraktığın ölüler artık seni izleyemeyecek. Dışarıda kimse seni beklemiyor. Yine de yürümek zorundasın.',
    'coastIntro': 'Kapıyı aştın, ama dışarıda güneş yok. Deniz bütün kasabayı yutmuş; kıyıya vuran ölüler köklere takılı kalmış. Burada da seni kimse beklemiyor.',
    'coastRoots': 'Yanmış ağaçların altında hâlâ kalpler atıyor. Her kök, toprağa gömülmüş birine uzanıyor.',
    'coastStreet': 'Kapılar içeriden kilitlendi. Su yükselirken kimse birbirine yardım etmedi. Şimdi hepsi aynı sokakta bekliyor.',
    'coastPier': 'Fenerleri takip etme. O ışıklar tekneleri kıyıya değil, derinliğe çağırdı.',
    'coastSquare': 'Meydanın altında yüzlerce mezar var. Çancı onların adlarını unuttu. Kökler unutmadı.',
    'coastCheckpoint': 'Son fener hâlâ yanıyor. Yeminin burada seni bulacak. Ardındaki çanlığa hazır git.',
    'coastBoss': 'Derinliklerin çancısı. Deniz onun göğsünde, mezarlar sırtında. Çanı sustur. Yoksa kıyı yeniden boğulacak.',
    'coastDeath': 'Deniz seni henüz almadı. Yemin seni kıyıya geri çağırıyor. Ayağa kalk.',
    'coastDeath2': 'Kökler bu kez tutamadı. Ama karanlık adını öğrendi. Yeniden yürü.',
    'coastDeath3': 'Çan hâlâ senin için çalıyor. Bu kıyıdan çıkmak istiyorsan onu sustur.',
    'coastSeal': 'Kökler gevşedi. Kıyının içlerine ilerle.',
    'coastWin': 'Çan sustu... Deniz çekilirken yüzler ortaya çıkıyor. Kimse kurtulmamış. Sen hâlâ nefes alıyorsun; bu kıyının sana verebildiği tek şey bu.',
    'intro':      'Seni buraya ölü sanıp attılar. Kör bir kılıç ve yırtık bezlerle uyandın... Yukarıda kimse seni beklemiyor. Çıkmak istiyorsan celladın zincirini kır.',
    'chains':     'Bu nöbetçiler celladın ilk kurbanlarıydı. Boyunlarındaki zincir onları bugün bile celladın emrinde tutuyor.',
    'ritual':     'Yaralıları buraya iyileşsinler diye getirdiler. Rahipler onların acısıyla ayini besledi.',
    'crypt':      'Sunağa dökülen kan, cellada güç veriyor. Bu ayin bitmeden tapınak susmayacak.',
    'rot':        'Bu kemikler mezarlarından söküldü. Geçidin taşlarına harç oldular. Celladın zincirini ayakta tutuyorlar.',
    'checkpoint': 'Yemin taşı seni hatırlayacak. Canını tazele. Sonraki kapının ardında cellat var.',
    'boss':       'Bu laneti cellat ayakta tutuyor. Zincirini kır.',
    'heroOath':   'Onları burada bırakmayacağım.',
    'cellat':     'Bu kapıdan kimse geçemez.',
    'seal':       'Zincirin bir halkası daha koptu. İlerle.',
    'death':      'Yemin henüz bozulmadı. Taş seni geri çağırıyor.',
    'death2':     'Bu mezar seni tutamayacak. Ayağa kalk.',
    'death3':     'Bir kez daha düştün. Ama yemin bozulmadı. Zinciri kırmak için yeniden ayağa kalk.',
    'win':        'Cellat sustu... Zincir kırıldı; ölüler sonunda mezarlarında kalabilecek. Ama açılan kapıdan gün ışığı gelmiyor. Dışarıda yalnızca çan sesi var.',
}
TTS_RATE, TTS_PITCH = '-12%', '-11Hz'   # ilahiler (chant) için düz TTS ayarı
VOICE_LUFS, VOICE_TP = -16.0, -1.5
VOICE_ENC = ['-ar', '32000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k']

# ---------------------------------------------------------------------------
# Kaynak paketleri (hepsi CC0). ASSET-LICENSES.md ile aynı liste.
# ---------------------------------------------------------------------------
OGA = 'https://opengameart.org/sites/default/files/'
SOURCES = {
    'kenney_impact':  ('https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip', 'Kenney - Impact Sounds', 'https://kenney.nl/assets/impact-sounds'),
    'kenney_rpg':     ('https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip', 'Kenney - RPG Audio', 'https://kenney.nl/assets/rpg-audio'),
    'rpg_pack':       (OGA + 'rpg_sound_pack.zip', 'artisticdude - RPG Sound Pack', 'https://opengameart.org/content/rpg-sound-pack'),
    'swishes':        (OGA + 'swishes.zip', 'artisticdude - Swishes Sound Pack', 'https://opengameart.org/content/swishes-sound-pack'),
    'zombies':        (OGA + 'zombies.zip', 'artisticdude - Zombies Sound Pack', 'https://opengameart.org/content/zombies-sound-pack'),
    'rpg80':          (OGA + '80-CC0-RPG-SFX_0.zip', 'rubberduck - 80 CC0 RPG SFX', 'https://opengameart.org/content/80-cc0-rpg-sfx'),
    'creature80':     (OGA + '80-CC0-creature-SFX_0.zip', 'rubberduck - 80 CC0 creature SFX', 'https://opengameart.org/content/80-cc0-creature-sfx'),
    'creature80b':    (OGA + '80-CC0-creature-sfx-2.zip', 'rubberduck - 80 CC0 creature SFX #2', 'https://opengameart.org/content/80-cc0-creture-sfx-2'),
    'sfx100':         (OGA + 'sfx_100_v2.zip', 'rubberduck - 100 CC0 SFX #2', 'https://opengameart.org/content/100-cc0-sfx-2'),
    'slightscreams':  (OGA + 'slightscreams.7z', 'qubodup - 15 Vocal Male Strain/Hurt/Pain/Jump Sounds', 'https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds'),
    'wetsquish':      (OGA + 'independent_nu_ljudbank-wet_squish_slurp_impacts.7z', 'Independent.nu / qubodup - 8 Wet Squish, Slurp Impacts', 'https://opengameart.org/content/8-wet-squish-slurp-impacts'),
    'wetbreaks':      (OGA + 'wet_breaks.zip', 'Zane Little Music - Fleshy bone break/snap SFX', 'https://opengameart.org/content/fleshy-bone-breaksnap-sfx'),
    'wettowel':       (OGA + 'wet_towel_on_body.7z', 'qubodup - 40 Wet Towel Club/Pound/Hit/Attack Sounds', 'https://opengameart.org/content/40-wet-towel-clubpoundhitattack-sounds'),
    'voicefx':        (OGA + 'Voice%20Effects%20Zombie-Skeleton-Monster%20Human%20Male.zip', 'ArcadeParty - Voice Effects Zombie/Skeleton/Monster/Human Male', 'https://opengameart.org/content/zombie-skeleton-monster-voice-effects'),
    'metalsteps':     (OGA + 'metal_steps_48k24b.7z', 'thimras - Metal footsteps on concrete', 'https://opengameart.org/content/metal-footsteps-on-concrete'),
    'winch':          (OGA + 'winch.zip', 'bart - Chain winch sounds', 'https://opengameart.org/content/chain-winch-sounds'),
    'ghostmoans':     (OGA + 'qubodup-GhostMoans.zip', 'qubodup - Ghost/Monster Voice: Moaning, Growling', 'https://opengameart.org/content/ghost-monster-voice-moaning-growling'),
    'human_pain':     (OGA + 'yelling%20sounds.zip', 'HaelDB - Male Grunt/Yelling sounds', 'https://opengameart.org/content/male-gruntyelling-sounds'),
}
# Birden çok varyantı olan efektler: her girdi bir kaynaktan işlenmiş bir parçadır.
#   f: paket içi dosya (tam yol)   ss/to: kesit (sn)   rate: tape hızı (<1 daha pes ve uzun)
#   pitch: rubberband yarım ton (süre değişmez)  hp/lp: filtre  fade: sonda sönüm (sn)
#   g: 'deep' (16 kHz, 24 kbps: çok pes sesler), 'lo' (22.05 kHz, 32 kbps: sesler, yaratıklar, et),
#      'hi' (32 kHz, 48 kbps: metal, zincir, adım)
#   Her parça tepe -1 dBFS'ye getirilir; göreli seviyeleri audio.js belirler.
S = lambda pack, f, **k: dict(pack=pack, f=f, **k)
VFX = 'Voice Effects Zombie-Skeleton-Monster Human Male/'
NPC = 'RPG Sound Pack/NPC/'
SFX = {
    # --- kahraman
    'step':      [S('kenney_impact', f'Audio/footstep_concrete_00{i}.ogg', lp=7000, g='hi') for i in (0, 1, 3, 4)],
    'scuff':     [S('kenney_rpg', 'Audio/footstep01.ogg', rate=.92, g='hi'), S('kenney_rpg', 'Audio/footstep03.ogg', rate=.9, g='hi')],
    'gear':      [S('rpg_pack', 'RPG Sound Pack/inventory/chainmail1.wav', to=.4, fade=.12, g='hi'), S('kenney_rpg', 'Audio/beltHandle1.ogg', to=.3, fade=.1, g='hi')],
    'swish':     [S('swishes', f'swishes/swish-{i}.wav', rate=.62, hp=120, g='hi') for i in (3, 4, 7, 9)],
    'cloth':     [S('rpg_pack', 'RPG Sound Pack/inventory/cloth-heavy.wav', rate=.9, g='hi'), S('kenney_rpg', 'Audio/cloth1.ogg', rate=.85, to=.5, fade=.15, g='hi')],
    'effort':    [S('slightscreams', f'slightscream-{i:02d}.flac', pitch=-2.2, lp=8500) for i in (1, 3, 11, 14)],
    'strain':    [S('slightscreams', f'slightscream-{i:02d}.flac', pitch=-2.6, lp=8500) for i in (6, 8)],
    'hurt':      [S('slightscreams', f'slightscream-{i:02d}.flac', pitch=-2.2, lp=8500) for i in (2, 4, 9, 12)],
    'herodeath': [S('voicefx', VFX + 'humanDeath2.wav', pitch=-2.5, lp=8000)],
    'roar':      [S('voicefx', VFX + 'humanYell1.wav', pitch=-3, lp=8500)],
    'drink':     [S('rpg_pack', 'RPG Sound Pack/inventory/bubble2.wav', rate=.8, to=.6, fade=.2)],
    'cork':      [S('rpg_pack', 'RPG Sound Pack/inventory/bottle.wav', to=.45, fade=.15, g='hi')],
    # --- darbeler
    'flesh':     [S('wetsquish', f'impsplat/impactsplat0{i}.mp3.flac', to=.4, fade=.15, g='hi') for i in (1, 3, 5, 7)],
    'thump':     [S('wettowel', f'wet_towel_on_body/wet_towel_on_body-{i:02d}.flac', to=.3, fade=.1, rate=.85, lp=6000, g='deep') for i in (3, 11, 24)],
    'bone':      [S('wetbreaks', f'Wet Break {i}.wav', to=.45, fade=.15, g='hi') for i in (2, 5, 8)],
    'armor':     [S('kenney_impact', f'Audio/impactPlate_heavy_00{i}.ogg', rate=.85, to=.5, fade=.2, g='hi') for i in (0, 2, 4)],
    'metal':     [S('kenney_impact', f'Audio/impactMetal_heavy_00{i}.ogg', g='hi') for i in (0, 2, 3)],
    'clank':     [S('kenney_impact', f'Audio/impactMetal_medium_00{i}.ogg', rate=.8, to=.4, fade=.15, g='hi') for i in (1, 3)],
    'shield':    [S('kenney_impact', f'Audio/impactPlank_medium_00{i}.ogg', rate=.8, to=.45, fade=.15) for i in (0, 2)],
    'shing':     [S('rpg_pack', 'RPG Sound Pack/battle/sword-unsheathe2.wav', to=.7, fade=.35, g='hi')],
    'debris':    [S('rpg80', f'stones_0{i}.ogg', to=.7, fade=.3) for i in (1, 3)],
    'bell':      [S('kenney_impact', 'Audio/impactBell_heavy_000.ogg', rate=.7, lp=5000, fade=.6, g='deep')],
    'rune':      [S('rpg80', 'spell_fire_06.ogg', rate=.8, to=.9, fade=.3)],
    # --- düşmanlar
    'prisonerYell':  [S('voicefx', VFX + f'zombieYell{i}.wav', pitch=-1.5) for i in (1, 2, 6, 10)],
    'prisonerDeath': [S('voicefx', VFX + f'zombieDeath{i}.wav', pitch=-1.5) for i in (2, 3)],
    'prisonerMoan':  [S('zombies', f'zombies/zombie-{i}.wav', pitch=-2, to=1.1, fade=.3) for i in (4, 12)],
    'chain':         [S('rpg80', f'chain_0{i}.ogg', to=.6, fade=.2, rate=.88, lp=6500, g='hi') for i in (1, 2, 3)],   # daha ağır, daha az cızırtılı
    'guardGrunt':    [S('rpg_pack', NPC + f'ogre/ogre{i}.wav', pitch=-4, lp=6000, g='deep') for i in (1, 3, 5)],
    'guardDeath':    [S('rpg_pack', NPC + 'giant/giant3.wav', pitch=-3, lp=6000, g='deep')],
    'armorStep':     [S('metalsteps', f'metal_steps_{i:02d}.wav', rate=.8, g='hi') for i in (1, 3, 5)],
    'cultistDeath':  [S('voicefx', VFX + 'humanDeath1.wav', pitch=-2, lp=7000)],
    'stalkerShriek': [S('rpg_pack', NPC + f'shade/shade{i}.wav', pitch=-1) for i in (1, 3, 5)],
    'stalkerDeath':  [S('rpg_pack', NPC + 'shade/shade7.wav', pitch=-2, to=1.0, fade=.3)],
    'carrierGurgle': [S('rpg_pack', NPC + f'slime/slime{i}.wav', rate=.75) for i in (2, 5, 8)],
    'spit':          [S('creature80', f'spit_0{i}.ogg', rate=.8) for i in (1, 3)],
    'carrierDeath':  [S('creature80', 'burble_01.ogg', rate=.7, to=1.1, fade=.3)],
    'wetStep':       [S('sfx100', f'sfx100v2_footstep_wet_0{i}.ogg', rate=.85) for i in (1, 3)],
    'bossRoar':      [S('rpg80', 'creature_roar_01.ogg', pitch=-3, lp=5000, g='deep'), S('rpg80', 'creature_roar_03.ogg', pitch=-3, lp=5000, g='deep'),
                      S('rpg_pack', NPC + 'giant/giant2.wav', pitch=-5, lp=5000, g='deep')],
    'bossDeath':     [S('rpg80', 'creature_die_01.ogg', rate=.8, lp=4500, g='deep')],
    'stomp':         [S('creature80b', 'stomp_01.ogg', rate=.8, lp=3000, g='deep')],
    'winch':         [S('winch', 'winch - Marker #5.wav', to=1.2, fade=.4, g='hi')],
    # --- ortam
    'moan':          [S('ghostmoans', 'qubodup-GhostMoans/wav/qubodup-GhostMoan03.wav', lp=3000, to=2.8, fade=.8, g='deep')],
}
# Tarikatçı (Kül Rahibi) ilahileri: AhmetNeural ile okutulup koro gibi işlenir (grup 'deep').
CHANTS = {
    'chant1': ('Kül ol... kan ol...', '-25%', '-20Hz'),
    'chant2': ('Toprak seni istiyor.', '-20%', '-18Hz'),
    'chant3': ('Kalkın! Kan sizi çağırıyor!', '-12%', '-14Hz'),
}
GROUPS = {
    'deep': ['-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '24k'],
    'lo': ['-ar', '22050', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k'],
    'hi': ['-ar', '32000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k'],
}
GAP = 0.06   # parçalar arasına konan sessizlik (sn)
# Eşitleme işareti: her sprite'ın başında, bilinen anda kısa bir ton. MP3 çözücüleri başa farklı uzunlukta
# gecikme ekler (Chrome kırpar, Safari kırpmayabilir); motor işareti bulup bütün dizini kaydırır.
LEAD, MARK_AT, MARK_HZ = 0.25, 0.05, 1500.0

# ---------------------------------------------------------------------------
def log(*a): print(*a, flush=True)

def ff(args, capture=False):
    cmd = [FFMPEG, '-hide_banner', '-nostdin', '-y', '-v', 'error' if not capture else 'info'] + args
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if p.returncode != 0:
        raise RuntimeError('ffmpeg failed: ' + ' '.join(args) + '\n' + p.stderr[-2000:])
    return p.stderr

def duration(path):
    if FFPROBE:
        p = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
        if p.returncode != 0:
            raise RuntimeError('ffprobe failed: ' + p.stderr[-1000:])
        return float(p.stdout.strip() or 0)
    # Portable FFmpeg packages sometimes omit ffprobe. Decode to null for the
    # actual media duration instead of guessing it from MP3 size or bit rate.
    p = subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-i', path, '-f', 'null', '-'], capture_output=True, text=True)
    spans = re.findall(r'time=(\d+):(\d+):(\d+(?:\.\d+)?)', p.stderr)
    if p.returncode != 0 or not spans:
        raise RuntimeError('Could not measure duration: ' + p.stderr[-1000:])
    h, m, s = spans[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)

def fetch(key):
    url, _, _ = SOURCES[key]
    base = os.path.join(CACHE, 'packs', key)
    if os.path.isdir(base) and os.listdir(base):
        return base
    os.makedirs(os.path.join(CACHE, 'packs'), exist_ok=True)
    archive = os.path.join(CACHE, 'packs', key + os.path.splitext(url)[1])
    if not os.path.exists(archive):
        log('  indiriliyor', url)
        req = urllib.request.Request(url, headers={'User-Agent': 'kara-gecit-audio-builder'})
        with urllib.request.urlopen(req) as r, open(archive, 'wb') as o:
            shutil.copyfileobj(r, o)
    os.makedirs(base, exist_ok=True)
    if archive.endswith('.zip'):
        with zipfile.ZipFile(archive) as z:
            z.extractall(base)
    else:  # .7z: bsdtar (macOS / Windows 10+ tar) ya da 7z
        tool = shutil.which('7z') or shutil.which('7za')
        cmd = [tool, 'x', '-y', '-o' + base, archive] if tool else ['tar', '-xf', archive, '-C', base]
        subprocess.run(cmd, check=True, capture_output=True)
    return base

def tts(text, rate, pitch, name):
    """Tam cümle kaydı ve hizmetin sözcük zamanları. Zamanlar ASR doğrulaması değildir."""
    os.makedirs(os.path.join(CACHE, 'tts'), exist_ok=True)
    h = hashlib.sha1(f'{VOICE}|{rate}|{pitch}|{text}'.encode()).hexdigest()[:16]
    path = os.path.join(CACHE, 'tts', f'{name}_{h}.mp3')
    meta_path = path + '.json'
    if not (os.path.exists(path) and os.path.exists(meta_path)):
        import edge_tts
        async def go():
            boundaries = []
            with open(path + '.part', 'wb') as out:
                async for chunk in edge_tts.Communicate(text, VOICE, rate=rate, pitch=pitch,
                                                        boundary='WordBoundary').stream():
                    if chunk['type'] == 'audio':
                        out.write(chunk['data'])
                    elif chunk['type'] == 'WordBoundary':
                        boundaries.append({k: chunk[k] for k in ('text', 'offset', 'duration')})
            if not boundaries or tokens(' '.join(b['text'] for b in boundaries)) != tokens(text):
                raise RuntimeError('TTS sözcük zamanları istenen metinle uyuşmuyor: ' + name)
            with open(meta_path + '.part', 'w', encoding='utf-8') as out:
                json.dump({'voice': VOICE, 'rate': rate, 'pitch': pitch, 'text': text,
                           'boundaries': boundaries}, out, ensure_ascii=False, indent=2)
            os.replace(path + '.part', path)
            os.replace(meta_path + '.part', meta_path)
        log('  seslendiriliyor:', text)
        asyncio.run(go())
    return path


def tokens(text):
    """Türkçe büyük/küçük harf ve noktalama farkını yok say; sözcükleri değiştirme."""
    return re.findall(r'\w+', text.replace('İ', 'i').replace('I', 'ı').lower())


def pcm(path):
    p = subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-v', 'error', '-i', path,
                        '-ar', '48000', '-ac', '1', '-f', 's16le', '-'], capture_output=True)
    if p.returncode:
        raise RuntimeError('PCM çözme başarısız: ' + p.stderr.decode('utf-8', errors='replace')[-1000:])
    samples = array.array('h', p.stdout)
    if sys.byteorder != 'little':
        samples.byteswap()
    if not samples:
        raise RuntimeError('Boş konuşma kaydı: ' + path)
    return samples


def trim_bounds(samples, boundary_end=0):
    """Yalnız dış sessizlik; iç duraklar ve zayıf son ünsüzler korunur.

    -60 dBFS üzerindeki her örnek korunur. Sonda hem gerçek dalga biçimine hem
    TTS'nin son sözcük zamanına en az 150 ms pay bırakılır. Sonda fade yoktur.
    """
    active = [i for i, v in enumerate(samples) if abs(v) > 32767 * 10 ** (-60 / 20)]
    if not active:
        raise RuntimeError('Konuşma yerine sessiz kayıt geldi.')
    rate = 48000
    start = max(0, active[0] / rate - .06)
    end = min(len(samples) / rate, max(active[-1] / rate, boundary_end) + .15)
    return start, end, active[-1] / rate

def tts_phrases(text, st, name):
    """Anlatıcı ritmi: edge-tts'in ücretsiz uç noktası SSML etiketlerini (break/emphasis/phoneme) reddediyor, yalnızca
    tek prosody kabul ediyor. Bu yüzden cümle ('.') ve '...' sınırlarında ayrı ayrı okutulur, her parça kendi hız/perdesiyle
    söylenir (son parça daha yavaş ve pes, hüküm gibi) ve aralarına ffmpeg ile ölçülü sessizlik konur.
    ('...' = uzun, '.' = orta boşluk.) Döndürdüğü tek MP3 yolu metin+stile göre önbelleğe alınır."""
    os.makedirs(os.path.join(CACHE, 'tts'), exist_ok=True)
    pieces = []   # (metin, sonraki boşluk sn)
    for m in re.finditer(r'(.+?)(\.\.\.|(?<=[.!?])(?=\s|$)|$)\s*', text):
        t = m.group(1).strip()
        if not t:
            continue
        ell = m.group(2) == '...'
        pieces.append([t + ('.' if ell else ''), st['ell'] if ell else st['gap']])
    sig = json.dumps([VOICE, pieces, st['rate'], st['rate_last'], st['tts_pitch'], st['pitch_last']], ensure_ascii=False)
    path = os.path.join(CACHE, 'tts', f"{name}_{hashlib.sha1(sig.encode()).hexdigest()[:16]}.mp3")
    if os.path.exists(path):
        return path
    import edge_tts
    work = tempfile.mkdtemp(prefix='kara_phr_')
    lst, n = [], len(pieces)
    for i, (t, gap) in enumerate(pieces):
        last = i == n - 1
        raw = os.path.join(work, f'p{i}.mp3'); wav = os.path.join(work, f'p{i}.wav')
        log('  seslendiriliyor:', t)
        asyncio.run(edge_tts.Communicate(t, VOICE, rate=st['rate_last'] if last else st['rate'],
                                         pitch=st['pitch_last'] if last else st['tts_pitch']).save(raw))
        ff(['-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,'
            'areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,areverse,aresample=48000', '-ac', '1', wav])
        lst.append(wav)
        if not last:
            sil = os.path.join(work, f's{i}.wav')
            ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', f'{gap / 1000:.3f}', sil]); lst.append(sil)
    lf = os.path.join(work, 'l.txt')
    open(lf, 'w').write(''.join(f"file '{x}'\n" for x in lst))
    ff(['-f', 'concat', '-safe', '0', '-i', lf, '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', path])
    shutil.rmtree(work, ignore_errors=True)
    return path

def room_ir(path, seconds=1.5, decay=4.4, lp=3800, predelay=.014):
    """Taş oda için yapay dürtü yanıtı: gecikmeli, üstel sönümlü, alçak geçirgen pembe gürültü."""
    if os.path.exists(path):
        return path
    ff(['-f', 'lavfi', '-i', f'anoisesrc=d={seconds}:c=pink:r=48000:a=0.6:s=7',
        '-af', f"aeval='val(0)*exp(-{decay}*t)*gte(t,{predelay})':c=same,lowpass=f={lp},highpass=f=160,afade=t=out:st={seconds-.25}:d=0.25",
        '-ac', '1', path])
    return path

def loudnorm(inp, out, target, tp, extra_out=()):
    """İki geçişli EBU R128 eşitleme."""
    e = ff(['-i', inp, '-af', f'loudnorm=I={target}:TP={tp}:LRA=9:print_format=json', '-f', 'null', '-'], capture=True)
    m = json.loads(e[e.rindex('{'):e.rindex('}') + 1])
    af = (f"loudnorm=I={target}:TP={tp}:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    ff(['-i', inp, '-af', af + ',aresample=48000'] + list(extra_out) + [out])

VOICE_CHAIN = (
    # 1) kırpılmış TTS -> pes ton (formant=shifted: formantlar da iner, daha iri bir gövde), sızlayan sedasyon kesimi
    "[0:a]aresample=48000,rubberband=pitch={pitch}:formant={formant}:transients={trans}:detector=soft,"
    "deesser=i={deess}:m=0.5:f=0.5,"
    # 2) ton rengi: gürültü altı temizlik, göğüs, çamur kesimi, anlaşılırlık bandı
    "highpass=f=58,lowshelf=f=135:g={low},equalizer=f=320:t=q:w=1.1:g={mud},"
    "equalizer=f=2300:t=q:w=0.9:g={pres},equalizer=f=4300:t=q:w=1.2:g={air},highshelf=f=7500:g=-2,"
    # 3) ağır ama doğal sıkıştırma; bant teybi gibi hafif doyum (üst armonikler: 'boğuk ama kalın')
    "acompressor=threshold=0.07:ratio=3.2:attack=7:release=160:makeup=2.2:knee=3,{sat}apad=pad_dur=1.2,asplit=3[dry][wsrc][rsrc];"
    # 4) çok hafif fısıltı katmanı: aynı cümle, fazları rastgele (sesli değil nefesli), tiz bandı
    "[wsrc]afftfilt=real='hypot(re,im)*cos(6.2831853*random(0))':imag='hypot(re,im)*sin(6.2831853*random(1))':win_size=512:overlap=0.75,"
    "highpass=f=1300,lowpass=f=7000,volume={whisper}dB,adelay={wdelay}[wh];"
    # 5) taş oda yankısı (ön gecikmeli; gövde IR'den önce kısılır ki sözcükler bulanmasın)
    "[rsrc]highpass=f=240,adelay={predelay}[rs];[rs][1:a]afir=dry=0:wet=1,volume={reverb}dB[rv];"
    "[dry][wh][rv]amix=inputs=3:normalize=0,alimiter=limit=0.9:attack=3:release=60[o]"
)
# Üç aday stil (aynı 4 örnek cümle: tools/gen_narration.py voice --samples DIR ile karşılaştırılır).
#   A: "Kıdemli anlatıcı" - yavaş, kuru, yakın mikrofon.   B: "Mahzen" - yavaş, hafif doygun, taş salon yankısı.
#   C: "Fısıltı"       - çok yavaş, belirgin nefes katmanı, kısa oda.
BASE_FX = dict(pitch=0.95, formant='shifted', trans='mixed', low=2, mud=-2, pres=4, air=2, whisper=-21, wdelay=24,
               reverb=-15, predelay=14, deess=0.35, sat='', tts_pitch='-8Hz', pitch_last='-14Hz', ir=(1.5, 4.4, 3800, .014))
STYLES = {
    # Full sentences keep the native voice's coarticulation and emphasis.
    # No formant shift, artificial whisper or forced slower final syllable.
    'N': dict(BASE_FX, rate='-4%', rate_last='-4%', tts_pitch='+0Hz', pitch_last='+0Hz', ell=320, gap=180, whole=True),
    'D': dict(BASE_FX, rate='-8%', rate_last='-8%', tts_pitch='-3Hz', pitch_last='-3Hz', ell=320, gap=180, whole=True, dark=True),
    'H': dict(BASE_FX, rate='-1%', rate_last='-1%', tts_pitch='+0Hz', pitch_last='+0Hz', ell=320, gap=180, whole=True),
    'E': dict(BASE_FX, rate='-6%', rate_last='-6%', tts_pitch='+0Hz', pitch_last='+0Hz', ell=320, gap=180, whole=True),
    'A': dict(BASE_FX, rate='-20%', rate_last='-28%', tts_pitch='-6Hz', ell=650, comma=180, gap=380, reverb=-19, pres=5),
    'B': dict(BASE_FX, rate='-18%', rate_last='-27%', ell=800, comma=200, gap=460, pitch=0.93, low=3, whisper=-19, wdelay=32,
              reverb=-12, predelay=32, sat='asoftclip=type=tanh:param=1.5,', ir=(2.0, 3.4, 3400, .030)),
    'C': dict(BASE_FX, rate='-24%', rate_last='-32%', ell=900, comma=240, gap=520, pitch=0.96, whisper=-13, wdelay=12,
              reverb=-20, low=1, pres=5, air=3, ir=(.9, 6.0, 3600, .010)),
}
DEFAULT_STYLE = 'D'
CHARACTER_LINES = {'heroOath': ('Bahtiyar', 'H'), 'cellat': ('Zincir Celladı', 'E')}

def process_voice(raw, key, work, style=None):
    """TTS kaydını anlatıcı sesine çevirir; (normalize WAV, MP3) yollarını döndürür."""
    fx = STYLES[style or DEFAULT_STYLE]
    trimmed = os.path.join(work, key + '_t.wav')
    wet = os.path.join(work, key + '_w.wav')
    verification = None
    if fx.get('whole'):
        samples = pcm(raw)
        with open(raw + '.json', encoding='utf-8') as meta_file:
            meta = json.load(meta_file)
        last = meta['boundaries'][-1]
        boundary_end = (last['offset'] + last['duration']) / 10_000_000
        start, end, last_active = trim_bounds(samples, boundary_end)
        if end < boundary_end - .08:
            raise RuntimeError('TTS son sözcüğün zamanından önce bitiyor: ' + key)
        ff(['-i', raw, '-af', f'atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS', trimmed])
        # Native voice and its consonants stay intact. The dark reading gains a little chest body,
        # while the gentler compressor preserves the actual rise and fall of the spoken thought.
        tone = ('highpass=f=62,lowshelf=f=145:g=1.0,equalizer=f=290:t=q:w=1.2:g=-0.7,'
                'equalizer=f=2250:t=q:w=0.9:g=0.6,deesser=i=0.08:m=0.18:f=0.5,'
                'acompressor=threshold=0.16:ratio=1.25:attack=18:release=160') if fx.get('dark') else (
                'highpass=f=72,equalizer=f=260:t=q:w=1.2:g=-0.6,equalizer=f=2200:t=q:w=0.9:g=0.8,'
                'deesser=i=0.1:m=0.2:f=0.5,acompressor=threshold=0.14:ratio=1.4:attack=15:release=140')
        ff(['-i', trimmed, '-af', 'aresample=48000,' + tone + ',apad=pad_dur=0.12', '-ac', '1', wet])
        verification = dict(meta, raw_duration=len(samples) / 48000, trim_start=start, trim_end=end,
                            last_active=last_active, last_word_end=boundary_end,
                            source_tail=end-last_active, fade=False, echo=False)
        fin = wet
    else:
        ir = room_ir(os.path.join(CACHE, 'room_ir_%s.wav' % '_'.join(str(x) for x in fx['ir'])), *fx['ir'])
        ff(['-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,'
            'areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05,areverse', trimmed])
        ff(['-i', trimmed, '-i', ir, '-filter_complex', VOICE_CHAIN.format(**fx), '-map', '[o]', '-ac', '1', wet])
        cut = os.path.join(work, key + '_c.wav')
        ff(['-i', wet, '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-58dB,areverse', cut])
        d = duration(cut)
        fin = os.path.join(work, key + '_f.wav')
        ff(['-i', wet, '-af', f'atrim=0:{d:.3f},afade=t=out:st={max(0, d - .18):.3f}:d=0.18', fin])
    norm = os.path.join(work, key + '_n.wav')
    loudnorm(fin, norm, VOICE_LUFS, VOICE_TP)
    mp3 = os.path.join(work, key + '.mp3')
    ff(['-i', norm] + VOICE_ENC + [mp3])
    if verification:
        final_samples = pcm(mp3)
        _, _, final_active = trim_bounds(final_samples)
        # Decoded MP3 can have tiny quantization tails; retain a measurable quiet
        # guard after speech, without shortening the actual spoken recording.
        verification.update(duration=len(final_samples)/48000, final_active=final_active,
                            final_quiet_tail=len(final_samples)/48000-final_active)
        if verification['final_quiet_tail'] < .10:
            raise RuntimeError('Konuşmanın sonunda güvenli sessizlik yok: ' + key)
        with open(os.path.join(work, key + '.json'), 'w', encoding='utf-8') as out:
            json.dump(verification, out, ensure_ascii=False, indent=2)
    return norm, mp3

def build_voice(only=None, wav_dir=None, style=None):
    work = tempfile.mkdtemp(prefix='kara_voice_')
    out = {}
    for key, text in LINES.items():
        if only and key not in only:
            continue
        speaker, own_style = CHARACTER_LINES.get(key, ('Anlatıcı', style or DEFAULT_STYLE))
        st = STYLES[own_style]
        raw = tts(text, st['rate'], st['tts_pitch'], key) if st.get('whole') else tts_phrases(text, st, key)
        norm, mp3 = process_voice(raw, key, work, own_style)
        if wav_dir:
            os.makedirs(wav_dir, exist_ok=True)
            shutil.copy(norm, os.path.join(wav_dir, 'voice_' + key + '.wav')); shutil.copy(mp3, os.path.join(wav_dir, 'voice_' + key + '.mp3'))
            meta = os.path.join(work, key + '.json')
            if os.path.exists(meta):
                shutil.copy(meta, os.path.join(wav_dir, 'voice_' + key + '.json'))
        data = open(mp3, 'rb').read()
        out[key] = {'text': text, 'speaker': speaker, 'voice': VOICE, 'style': own_style,
                    'duration': round(duration(mp3), 3), 'audio': base64.b64encode(data).decode()}
        log(f'  {key:10s} {out[key]["duration"]:5.2f} sn  {len(data) // 1024:3d} KB')
    shutil.rmtree(work, ignore_errors=True)
    return out

SAMPLE_KEYS = ('intro', 'crypt', 'boss', 'death3')
def build_samples(dirpath):
    """Her stil için aynı 4 cümleyi (aralarında 0.9 sn boşlukla) tek MP3'e yazar: voice_A.mp3 ..."""
    os.makedirs(dirpath, exist_ok=True)
    for style in STYLES:
        work = tempfile.mkdtemp(prefix='kara_smp_')
        parts = []
        for key in SAMPLE_KEYS:
            st = STYLES[style]
            raw = tts(LINES[key], st['rate'], st['tts_pitch'], key) if st.get('whole') else tts_phrases(LINES[key], st, key)
            norm, _ = process_voice(raw, key, work, style)
            parts.append(norm)
        lst = os.path.join(work, 'l.txt')
        sil = os.path.join(work, 'sil.wav'); ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.9', sil])
        open(lst, 'w').write(''.join(f"file '{p}'\nfile '{sil}'\n" for p in parts))
        ff(['-f', 'concat', '-safe', '0', '-i', lst, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', os.path.join(dirpath, f'voice_{style}.mp3')])
        log('  örnek', style)
        shutil.rmtree(work, ignore_errors=True)

def build_clip(spec, work, name):
    base = fetch(spec['pack'])
    src = os.path.join(base, spec['f'])
    if not os.path.exists(src):
        raise FileNotFoundError(src)
    af = ['aformat=channel_layouts=stereo', 'pan=mono|c0=0.5*c0+0.5*c1', 'aresample=48000']
    if 'ss' in spec or 'to' in spec:
        af.append(f"atrim={spec.get('ss', 0)}:{spec.get('to', 60)}")
    af += ['silenceremove=start_periods=1:start_threshold=-50dB', 'areverse',
           'silenceremove=start_periods=1:start_threshold=-54dB', 'areverse']
    if 'rate' in spec:   # tape tarzı: pes ve daha uzun, daha ağır
        af += [f"asetrate={48000 * spec['rate']:.0f}", 'aresample=48000']
    if 'pitch' in spec:
        af.append(f"rubberband=pitch={2 ** (spec['pitch'] / 12):.4f}:formant=shifted:transients=crisp")
    af.append(f"highpass=f={spec.get('hp', 45)}")
    if 'lp' in spec:
        af.append(f"lowpass=f={spec['lp']}")
    if spec.get('rev'):
        af.append('areverse')
    af.append('afade=t=in:d=0.004')
    if 'fade' in spec:
        af += ['areverse', f"afade=t=in:d={spec['fade']}", 'areverse']
    mid = os.path.join(work, name + '.wav')
    ff(['-i', src, '-af', ','.join(af), mid])
    # tepe değerini -1 dBFS'ye getir (motor kendi kazançlarını uygular)
    e = ff(['-i', mid, '-af', 'astats=measure_overall=Peak_level:measure_perchannel=none', '-f', 'null', '-'], capture=True)
    peak = float(re.findall(r'Peak level dB: ([-\d.]+)', e)[-1])
    return mid, -1.0 - peak

def build_chant(key, text, rate, pitch, work):
    raw = tts(text, rate, pitch, 'chant_' + key)
    mid = os.path.join(work, key + '.wav')
    ir = room_ir(os.path.join(CACHE, 'hall_ir_v1.wav'), seconds=2.6, decay=2.6, lp=3000, predelay=.03)
    # üç ses: pes, daha pes ve fısıltı; biraz kaydırılmış -> bir koro gibi
    graph = ("[0:a]silenceremove=start_periods=1:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_threshold=-48dB,areverse,"
             "aresample=48000,apad=pad_dur=1.2,asplit=4[a][b][c][d];"
             "[a]rubberband=pitch=0.749:formant=shifted[a1];"
             "[b]rubberband=pitch=0.63:formant=shifted,adelay=38,volume=-4dB[b1];"
             "[c]afftfilt=real='hypot(re,im)*cos(6.2831853*random(0))':imag='hypot(re,im)*sin(6.2831853*random(1))':win_size=512:overlap=0.75,"
             "rubberband=pitch=0.84,highpass=f=900,volume=-6dB,adelay=70[c1];"
             "[d]rubberband=pitch=0.749:formant=shifted,highpass=f=200[d1];[d1][1:a]afir=dry=0:wet=1,volume=-6dB[r];"
             "[a1][b1][c1][r]amix=inputs=4:normalize=0,highpass=f=90,lowpass=f=5200,equalizer=f=600:t=q:w=1:g=2,"
             "acompressor=threshold=0.1:ratio=3:attack=10:release=200,alimiter=limit=0.9[o]")
    ff(['-i', raw, '-i', ir, '-filter_complex', graph, '-map', '[o]', '-ac', '1', mid])
    cut = os.path.join(work, key + '_c.wav')
    ff(['-i', mid, '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse,afade=t=in:d=0.01', cut])
    d = min(duration(cut), 2.4)
    fin = os.path.join(work, key + '_f.wav')
    ff(['-i', cut, '-af', f'atrim=0:{d:.3f},afade=t=out:st={max(0, d - .45):.3f}:d=0.45', fin])
    e = ff(['-i', fin, '-af', 'astats=measure_overall=Peak_level:measure_perchannel=none', '-f', 'null', '-'], capture=True)
    peak = float(re.findall(r'Peak level dB: ([-\d.]+)', e)[-1])
    return fin, -1.0 - peak

def build_sfx(wav_dir=None):
    """Tüm efektleri iki MP3 'sprite' dosyasında birleştirir: dosya başına MP3 başlık/boşluk yükü olmaz ve
    açılışta yalnızca iki çözümleme yapılır. Dizin: clips[ad] = [[grup, başlangıç_sn, süre_sn], ...]."""
    import wave
    work = tempfile.mkdtemp(prefix='kara_sfx_')
    parts = {g: [] for g in GROUPS}
    items = [(n, i, v) for n, vs in SFX.items() for i, v in enumerate(vs)] + [(k, 0, None) for k in CHANTS]
    for name, i, spec in items:
        if spec is None:
            mid, gain = build_chant(name, *CHANTS[name], work); group = 'deep'
        else:
            mid, gain = build_clip(spec, work, f'{name}_{i}'); group = spec.get('g', 'lo')
        fin = os.path.join(work, f'{name}_{i}_g.wav')
        ff(['-i', mid, '-af', f'volume={gain:.2f}dB,aresample=48000', '-ac', '1', '-c:a', 'pcm_s16le', fin])
        with wave.open(fin) as w:
            frames = w.readframes(w.getnframes())
        parts[group].append((name, frames))
        if wav_dir:
            os.makedirs(wav_dir, exist_ok=True); shutil.copy(fin, os.path.join(wav_dir, f'{name}_{i}.wav'))
    sprites, clips = {}, {}
    import math, struct
    n_mark = int(0.004 * 48000)
    for group, lst in parts.items():
        gap = b'\x00\x00' * int(GAP * 48000)
        pcm = bytearray(b'\x00\x00' * int(LEAD * 48000))
        for k in range(n_mark):   # Hann pencereli 4 ms ton; tepe noktası MARK_AT'ta
            v = 0.8 * math.sin(2 * math.pi * MARK_HZ * k / 48000) * (0.5 - 0.5 * math.cos(2 * math.pi * k / (n_mark - 1)))
            struct.pack_into('<h', pcm, (int((MARK_AT - 0.002) * 48000) + k) * 2, int(v * 32767))
        for name, frames in lst:
            start = len(pcm) // 2
            pcm += frames
            clips.setdefault(name, []).append([group, round(start / 48000, 5), round(len(frames) / 2 / 48000, 5)])
            pcm += gap
        raw = os.path.join(work, f'sprite_{group}.wav')
        with wave.open(raw, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000); w.writeframes(bytes(pcm))
        mp3 = os.path.join(work, f'sprite_{group}.mp3')
        ff(['-i', raw] + GROUPS[group] + [mp3])
        if wav_dir:
            shutil.copy(mp3, os.path.join(wav_dir, f'sprite_{group}.mp3')); shutil.copy(raw, os.path.join(wav_dir, f'sprite_{group}.wav'))
        data = open(mp3, 'rb').read()
        sprites[group] = base64.b64encode(data).decode()
        log(f'  sprite {group}: {len(lst)} parça, {len(pcm) / 2 / 48000:5.1f} sn, {len(data) // 1024} KB mp3, {len(sprites[group]) // 1024} KB base64')
    for name, lst in clips.items():
        log(f'  {name:14s} x{len(lst)}  ' + ' '.join(f'{d:.2f}' for _, _, d in lst))
    shutil.rmtree(work, ignore_errors=True)
    return {'mark': MARK_AT, 'sprites': sprites, 'clips': clips}

def build_ambient(bank, wav_dir=None):
    """Add recorded, acted human pain without regenerating the combat bank.

    HaelDB's four performers are licensed CC0 on the source page. This is
    dramatic voice acting, never a recording of actual suffering. The legacy
    tortSob/tortWhisper keys now contain strained breaths, not synthetic speech.
    """
    import math, struct, wave
    specs = {
        'tortScream': [(f, r) for f, r in [('1yell3.wav', 1), ('1yell11.wav', .98), ('2yell4.wav', 1.03),
                        ('2yell6.wav', 1), ('3yell13.wav', .96), ('3yell16.wav', 1), ('yell1.wav', 1), ('yell11.wav', .99)]],
        'tortMoan': [('1yell4.wav', .88), ('2yell11.wav', .93), ('3grunt6.wav', .94), ('3yell9.wav', .93)],
        'tortSob': [('3grunt1.wav', 1), ('3grunt2.wav', .96), ('3grunt6.wav', 1.02)],
        'tortGurgle': [('3yell13.wav', .88), ('1yell16.wav', .95)],
        'tortWhisper': [('3grunt6.wav', .89), ('3grunt2.wav', .87)],
    }
    work = tempfile.mkdtemp(prefix='kabir_acted_')
    try:
        pcm = bytearray(b'\0\0' * int(LEAD * 48000))
        nm = int(.004 * 48000)
        for k in range(nm):
            v = .8 * math.sin(2 * math.pi * MARK_HZ * k / 48000) * (.5 - .5 * math.cos(2 * math.pi * k / (nm - 1)))
            struct.pack_into('<h', pcm, (int((MARK_AT - .002) * 48000) + k) * 2, int(v * 32767))
        for name, choices in specs.items():
            bank['clips'][name] = []
            for i, (filename, rate) in enumerate(choices):
                spec = S('human_pain', 'yelling sounds/' + filename, rate=rate, hp=95, lp=6000, fade=.1)
                mid, gain = build_clip(spec, work, f'{name}_{i}')
                fin = os.path.join(work, f'{name}_{i}_g.wav')
                ff(['-i', mid, '-af', f'volume={gain - 1:.2f}dB,aresample=48000', '-ac', '1', '-c:a', 'pcm_s16le', fin])
                with wave.open(fin) as w:
                    frames = w.readframes(w.getnframes())
                start = len(pcm) / 2 / 48000
                pcm += frames
                bank['clips'][name].append(['pain', round(start, 5), round(len(frames) / 2 / 48000, 5)])
                pcm += b'\0\0' * int(GAP * 48000)
                if wav_dir:
                    os.makedirs(wav_dir, exist_ok=True)
                    shutil.copy(fin, os.path.join(wav_dir, f'{name}_{i}.wav'))
        raw = os.path.join(work, 'sprite_pain.wav')
        with wave.open(raw, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000); w.writeframes(pcm)
        mp3 = os.path.join(work, 'sprite_pain.mp3')
        ff(['-i', raw, '-ar', '32000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', mp3])
        bank['sprites']['pain'] = base64.b64encode(open(mp3, 'rb').read()).decode()
        if wav_dir:
            shutil.copy(raw, os.path.join(wav_dir, 'sprite_pain.wav'))
            shutil.copy(mp3, os.path.join(wav_dir, 'sprite_pain.mp3'))
        log(f'  acted pain: {sum(map(len, specs.values()))} clips, {len(pcm) / 2 / 48000:.1f} seconds')
        return bank
    finally:
        shutil.rmtree(work, ignore_errors=True)

def read_existing():
    narration, bank = {}, {}
    if os.path.exists(OUT_JS):
        for line in open(OUT_JS, encoding='utf-8'):
            if line.startswith('window.BABA.Narration = '):
                narration = json.loads(line[len('window.BABA.Narration = '):].rstrip().rstrip(';'))
            elif line.startswith('window.BABA.SoundBank = '):
                bank = json.loads(line[len('window.BABA.SoundBank = '):].rstrip().rstrip(';'))
            elif line.startswith('window.BABA.Narration=') or line.startswith('window.BABA.Narration ='):
                pass
    return narration, bank

def write_js(narration, bank):
    head = ('// KARA GEÇİT - gömülü sesler. Bu dosya tools/gen_narration.py ile üretilir; elle düzenleme.\n'
            '// Narration: tr-TR-AhmetNeural, doğal Türkçe okumalar. SoundBank: CC0 paketlerden efektler\n'
            '// (kaynaklar ve lisanslar: ASSET-LICENSES.md). file:// ile çalışması için base64 MP3 olarak gömülüdür.\n'
            'window.BABA = window.BABA || {};\n')
    with open(OUT_JS, 'w', encoding='utf-8', newline='\n') as o:
        o.write(head)
        o.write('window.BABA.Narration = ' + json.dumps(narration, ensure_ascii=False, separators=(',', ':')) + ';\n')
        o.write('window.BABA.SoundBank = ' + json.dumps(bank, ensure_ascii=False, separators=(',', ':')) + ';\n')
    log(f'yazıldı: {OUT_JS}  ({os.path.getsize(OUT_JS) // 1024} KB)')

def main(argv):
    what = [a for a in argv if a in ('voice', 'sfx', 'ambient')] or ['voice', 'sfx', 'ambient']
    only = None
    wav_dir = None
    if '--only' in argv:
        only = set(argv[argv.index('--only') + 1].split(','))
    if '--wav' in argv:
        wav_dir = os.path.abspath(argv[argv.index('--wav') + 1])
    style = argv[argv.index('--style') + 1] if '--style' in argv else None
    if '--samples' in argv:
        return build_samples(os.path.abspath(argv[argv.index('--samples') + 1]))
    narration, bank = read_existing()
    if 'voice' in what:
        log('Anlatıcı cümleleri...')
        fresh = build_voice(only, wav_dir, style)
        narration = {k: (fresh.get(k) or narration.get(k)) for k in LINES if fresh.get(k) or narration.get(k)}
    if 'sfx' in what:
        log('Efekt bankası...')
        bank = build_sfx(wav_dir)
    if 'ambient' in what:
        if not bank.get('clips'):
            raise RuntimeError('Generate the combat SFX bank before adding ambient recordings.')
        bank = build_ambient(bank, wav_dir)
    write_js(narration, bank)

if __name__ == '__main__':
    main(sys.argv[1:])
