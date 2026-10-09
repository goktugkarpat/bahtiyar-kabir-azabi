#!/usr/bin/env python3
"""Rebuild boss thumbnails from an approved native actual-equipment bake.

Usage: python tools/boss_icons.py --native-evidence /absolute/icons-bake.json
This importer reproduces the asset bundle from approved native pixel evidence; it does not perform the 3D rendering itself. The offline browser baker must compare all20 replacement candidates against their former
surrogate model, render only changed geometry, and retain complete alpha bounds.
Existing aliases/badges remain. This importer never substitutes another item's
render or creates models; source geometry hashes and captured source checksums
are retained in a separate provenance manifest.
"""
import argparse,base64,hashlib,json,re
from pathlib import Path
TARGETS=set('rusted-mail-chest headsman-hood hook-chain-gauntlets drowned-clapper-axe bellringer-bronze-chest drowned-ringer-helm tide-chain-boots hollow-scepter-spear king-ossuary-chest hollow-king-spurs warden-iron-claws heart-forged-sword anvil-heart-chest furnace-heart-helm cinder-breath-boots ash-warden-greaves black-gavel-axe qadi-black-robe qadi-iron-turban verdict-warden-boots'.split())
def digest(data):return hashlib.sha256(data).hexdigest()
def read_dictionary(text,name):
 m=re.search(r'const '+name+r'\s*=\s*(\{.*?\})\s*;',text,re.S)
 if not m:raise ValueError('No '+name+' dictionary in existing extension')
 return json.loads(m.group(1))
def validate_webp(value):
 if not isinstance(value,str) or not value.startswith('data:image/webp;base64,'):raise ValueError('Expected native WebP dataURL')
 raw=base64.b64decode(value.split(',',1)[1],validate=True)
 if raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP':raise ValueError('Invalid WebP bytes')
 return digest(raw)
def rebuild(source,evidence,output,manifest):
 before=source.read_bytes();text=before.decode('utf-8');e=json.loads(evidence.read_text(encoding='utf-8'))
 if e.get('name')!='icons-bake' or e.get('size')!=256 or e.get('errors') or e.get('invalid'):raise ValueError('Native bake failed or wrong dimensions')
 comparison=e.get('geometryComparison',[])
 if len(comparison)!=20 or {r['id'] for r in comparison}!=TARGETS:raise ValueError('Expected exact20 actual geometry identity comparisons')
 changed={r['id'] for r in comparison if r['differentGeometry']};images=e['images'];ground=e['ground']
 if set(images)!=changed or set(ground)!=changed:raise ValueError('Native output must exactly match changed geometry; aliases cannot be regenerated')
 metrics={r['id']:r for r in e['pixelMetrics']}
 for item in changed:
  if metrics[item]['edge']!=0 or metrics[item].get('croppedByDesign'):raise ValueError('Ground physical silhouette is clipped: '+item)
  if metrics[item]['occupied']<300 or metrics[item]['transparent']<100:raise ValueError('Empty/opaque ground render: '+item)
  validate_webp(images[item]);validate_webp(ground[item])
 try:ui=read_dictionary(text,'own');world=dict(ui)
 except ValueError:ui=read_dictionary(text,'ui');world=read_dictionary(text,'ground')
 untouched=set(ui)-changed;old={k:(ui[k],world[k])for k in untouched};ui.update(images);world.update(ground)
 assert all((ui[k],world[k])==old[k] for k in untouched)
 body='/* Native actual-equipped boss reward renders: separate framed UI and complete transparent world silhouettes. Rebuilt by tools/boss_icons.py from approved native bake; provenance in boss-thumbnails.provenance.json. */\n(function(){const B=window.BABA=window.BABA||{};\nconst ui='+json.dumps(ui,separators=(',',':'))+';\nconst ground='+json.dumps(world,separators=(',',':'))+';\nB.EquipmentThumbnails=Object.freeze(Object.assign({},B.EquipmentThumbnails||{},ui));\nB.GroundEquipmentThumbnails=Object.freeze(Object.assign({},B.GroundEquipmentThumbnails||{},ground));})();\n'
 output.write_bytes(body.encode('utf-8'))
 record={'method':'Native actual equipped geometry; compact rigid pair arrangement for hands/boots, original vertex form/materials; full bounds for ground. UI silhouette rim and existing circular boss crest retained. No surrogate item rendering.', 'evidenceSha256':digest(evidence.read_bytes()),'previousExtensionSha256':digest(before),'extensionSha256':digest(output.read_bytes()),'sourceProvenance':[{'path':r['url'].split('?')[0].split('/src/')[-1] if '/src/' in r['url'] else r['url'].split('?')[0].split('/assets/')[-1],'sha256':r['sha256']}for r in e.get('sourceProvenance',[])],'changed':sorted(changed),'untouched':sorted(untouched),'geometryComparison':comparison,'framing':e['framing'],'pixelMetrics':e['pixelMetrics'],'imageSha256':{k:{'ui':validate_webp(images[k]),'ground':validate_webp(ground[k])}for k in sorted(changed)}}
 manifest.write_bytes(json.dumps(record,ensure_ascii=False,indent=2).encode('utf-8'));return record
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--native-evidence',required=True,type=Path);parser.add_argument('--source',type=Path);parser.add_argument('--output',type=Path);parser.add_argument('--manifest',type=Path);args=parser.parse_args()
 root=Path(__file__).resolve().parents[1];source=args.source or root/'assets/equipment/boss-thumbnails.js';output=args.output or source;manifest=args.manifest or output.with_suffix('.provenance.json')
 record=rebuild(source,args.native_evidence,output,manifest);print('Rebuilt',len(record['changed']),'actual-model icons; preserved',len(record['untouched']),'existing icons. SHA256',record['extensionSha256'])
