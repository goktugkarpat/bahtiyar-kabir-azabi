#!/usr/bin/env python3
"""Requires edge-tts and ffmpeg/ffprobe. Reads src/narration-story-text.json.
Preserves original voice keys and offline/file:// embedded MP3 support.
Run after other voice generators to apply the canonical story mix.
"""
import asyncio,base64,hashlib,json,subprocess,tempfile,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
LINES=json.loads((ROOT/'src/narration-story-text.json').read_text(encoding='utf-8'))
CACHE=Path(tempfile.gettempdir())/'kabir-story-voice-cache'; CACHE.mkdir(exist_ok=True)
CONF={'tr':('tr-TR-AhmetNeural','-10%','-6Hz'),'en':('en-US-SteffanNeural','-14%','-12Hz')}
FILTER='silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.035:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.10:detection=peak,areverse,afade=t=in:d=0.006,highpass=f=60,lowpass=f=7600,equalizer=f=120:t=q:w=0.9:g=2,aecho=0.8:0.85:70:0.08,alimiter=limit=0.92'
async def record(lang,key,line,sem):
 import edge_tts
 text=line[lang]; voice,rate,pitch=CONF[lang]
 digest=hashlib.sha256(json.dumps([text,CONF[lang],FILTER]).encode()).hexdigest()[:12]
 p=CACHE/f'{lang}-{key}-{digest}.mp3'
 async with sem:
  if not p.exists():
   for attempt in range(4):
    raw=p.with_suffix('.raw.mp3')
    try:
     await edge_tts.Communicate(text,voice,rate=rate,pitch=pitch).save(str(raw))
     subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(raw),'-af',FILTER,'-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','48k',str(p)],check=True)
     raw.unlink(missing_ok=True)
     break
    except Exception:
     if attempt==3: raise
     await asyncio.sleep(2*(attempt+1))
  d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)]))
  assert d>1 and p.stat().st_size>1000
  print(lang,key,round(d,2),flush=True)
  return lang,key,{'text':text,'speaker':'Anlatıcı' if lang=='tr' else 'Narrator','voice':voice,'style':'D','duration':round(d,3),'chapter':line['chapter'],'audio':base64.b64encode(p.read_bytes()).decode()}
async def main():
 sem=asyncio.Semaphore(3)
 records=await asyncio.gather(*(record(l,k,v,sem) for k,v in LINES.items() for l in CONF))
 out={'tr':{},'en':{}}
 for l,k,v in records:out[l][k]=v

 owners=[('narration.js','window.BABA.Narration = ','tr'),('narration-en.js','window.BABA.NarrationEN = ','en'),('narration-quests.js','  var TR = ','tr'),('narration-quests.js','  var EN = ','en')]
 edits={};count=0
 for filename,prefix,lang in owners:
  p=ROOT/'src'/filename
  source=edits.get(p,p.read_text(encoding='utf-8'))
  begin=source.index(prefix)+len(prefix)
  old,length=json.JSONDecoder().raw_decode(source[begin:])
  for key,record in out[lang].items():
   if key in old:
    old[key].update(record); count+=1
  edits[p]=source[:begin]+json.dumps(old,ensure_ascii=False,separators=(',',':'))+source[begin+length:]
 assert count==len(LINES)*2,(count,len(LINES))
 if args.apply:
  for p,source in edits.items(): p.write_bytes(source.encode('utf-8'))
 print(f'{count} verified matching records; '+('embedded in original owners' if args.apply else 'cached only; use --apply to embed'),flush=True)
def verify_existing():
 owners=[('narration.js','window.BABA.Narration = ','tr'),('narration-en.js','window.BABA.NarrationEN = ','en'),('narration-quests.js','  var TR = ','tr'),('narration-quests.js','  var EN = ','en')]
 found=set()
 with tempfile.TemporaryDirectory(prefix='kabir-story-verify-') as directory:
  for filename,prefix,lang in owners:
   source=(ROOT/'src'/filename).read_text(encoding='utf-8')
   records,_=json.JSONDecoder().raw_decode(source[source.index(prefix)+len(prefix):])
   for key,line in LINES.items():
    if key not in records:continue
    record=records[key];assert record['text']==line[lang],(lang,key,'text mismatch')
    identity=(lang,key);assert identity not in found,identity;found.add(identity)
    path=Path(directory)/f'{lang}-{key}.mp3';path.write_bytes(base64.b64decode(record['audio'],validate=True))
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',str(path)]))
    stream=probe['streams'][0];duration=float(probe['format']['duration'])
    assert stream['codec_name']=='mp3' and stream['channels']==1 and int(stream['sample_rate'])==24000,(lang,key,stream)
    assert abs(duration-record['duration'])<0.02 and duration>1,(lang,key,duration)
 assert len(found)==len(LINES)*2,(len(found),len(LINES)*2)
 print(json.dumps({'verified':len(found),'networkUsed':False,'sourceWrites':False}),flush=True)

parser=argparse.ArgumentParser(description='Record the canonical Grave Torment story in Turkish and English; preserve unrelated voices and SoundBank.')
parser.add_argument('--apply',action='store_true',help='Embed the generated matching text/audio records into their existing source owners.')
parser.add_argument('--verify-only',action='store_true',help='Offline: validate embedded text and MP3 metadata without contacting TTS or changing source files.')
args=parser.parse_args()
if args.apply and args.verify_only:parser.error('--apply and --verify-only are mutually exclusive')

if args.verify_only:verify_existing()
else:asyncio.run(main())
