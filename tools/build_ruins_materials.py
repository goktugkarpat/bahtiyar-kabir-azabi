#!/usr/bin/env python3
"""Pack verified Poly Haven monastery stone maps as a local classic script.
Usage: python3 tools/build_ruins_materials.py /tmp/kabir-ruins-pbr [--download]
"""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
def main():
    folder=Path(sys.argv[1]);folder.mkdir(parents=True,exist_ok=True)
    entry={'source':'monastery_stone_floor'}
    for item in json.loads((ROOT/'tools/ruins-material-sources.json').read_text())['maps']:
        source=folder/item['filename']
        if '--download' in sys.argv and not source.exists():
            subprocess.run(['curl','-fsSL','--retry','2',item['url'],'-o',str(source)],check=True)
        if hashlib.md5(source.read_bytes()).hexdigest()!=item['md5']:raise ValueError('Source checksum mismatch: '+str(source))
        packed=folder/(item['channel']+'.webp')
        cmd=[shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source),'-vf','scale={0}:{0}:flags=lanczos'.format(item['size']),'-c:v','libwebp','-compression_level','6','-q:v',str(item['quality'])]
        cmd+=['-pix_fmt','bgra','-lossless','1'] if item['channel']=='arm' else ['-pix_fmt','yuv420p']
        subprocess.run(cmd+[str(packed)],check=True)
        entry[item['channel']]='data:image/webp;base64,'+base64.b64encode(packed.read_bytes()).decode()
    output=ROOT/'assets/ruins/surfaces.js';output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text('/* Poly Haven / Amal Kumar, CC0. Processing: ASSET-LICENSES.md. */\nwindow.BABA.CoastSurfaceData.monastery='+json.dumps(entry,separators=(',',':'))+';\n')
    print(output.stat().st_size,'bytes, embedded local monastery PBR maps')
if __name__=='__main__':main()
