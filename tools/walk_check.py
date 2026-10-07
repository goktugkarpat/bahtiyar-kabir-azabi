"""Yurunebilirlik regresyon testi / walkability regression check.

Her bolumde oyuncu baslangicindan (world.spawn) su hedeflere yol bulunup YURUNEREK varilabiliyor mu bakar:
tum gorev yerleri (world.questSites), yemin tasi (checkpoint), boss, tum dusman dogus noktalari.

Kullanim:  python tools/walk_check.py [bolumler, ornek: 2 4]   (varsayilan: 2 4)
QA yardimcisi (qa.py, Playwright + Chrome) gerekir; yolu QA_DIR ortam degiskeni ya da --qa ile verilir.
Cikis kodu: hepsi gecerse 0, aksi halde 1.
"""
import os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
qa_dir = os.environ.get('QA_DIR')
for a in sys.argv[1:]:
    if a.startswith('--qa='):
        qa_dir = a[5:]
if qa_dir:
    sys.path.insert(0, qa_dir)
from qa import Game  # noqa: E402

JS = r"""(()=>{const w=BABA.app.world,s0=w.spawn||{x:0,z:10};
function walk(b){const p={x:s0.x,z:s0.z};const path=w.pathTo(p,{x:b.x,z:b.z},.5);if(!path.length)return -1;
 for(const t of path){for(let k=0;k<3000;k++){const dx=t.x-p.x,dz=t.z-p.z,d=Math.hypot(dx,dz);if(d<.3)break;const s=Math.min(.2,d);w.move(p,dx/d*s,dz/d*s,.45);}}
 return Math.hypot(p.x-b.x,p.z-b.z);}
const out=[];const S=w.questSites||{};for(const k of Object.keys(S))out.push(['site:'+k,walk(S[k])]);
if(w.checkpoint)out.push(['checkpoint',walk({x:w.checkpoint.x,z:w.checkpoint.z+3})]);
if(w.bossSpawn)out.push(['boss',walk({x:w.bossSpawn.x,z:w.bossSpawn.z+8})]);
(w.encounters||[]).forEach(e=>(e.spawns||[]).forEach((s,i)=>{if(s.boss)return;out.push(['spawn:'+e.id+'#'+i,w.isWalkable(s.x,s.z,.5)?walk(s):-2]);}));
return JSON.stringify(out);})()"""

chapters = [int(a) for a in args] or [2, 4]
failed = 0
for ch in chapters:
    with Game(root=ROOT, chapter=ch, level=12, width=640, height=360) as g:
        g.play(); g.step(10)
        res = json.loads(g.js(JS))
        errs = [e for e in g.errors if 'Failed to load resource' not in e]
        bad = [(k, v) for k, v in res if v < 0 or v > .6]
        print(f'bolum {ch}: {len(res)} hedef, {len(bad)} basarisiz' + ('' if not errs else f', JS hatalari: {errs[:3]}'))
        for k, v in bad:
            print('   x', k, 'yol yok' if v == -1 else 'yurunemez nokta' if v == -2 else f'{v:.1f} m kaldi')
        failed += len(bad) + (1 if errs else 0)
sys.exit(1 if failed else 0)
