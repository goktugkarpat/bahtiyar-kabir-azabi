#!/usr/bin/env python3
"""Rebuild the local classic-script PBR bundle from verified original downloads.
Usage: python3 tools/build_coast_materials.py /tmp/kabir-pbr [--download]
Requires curl and ffmpeg; no dependencies or remote requests in the game itself.
"""
import base64
import concurrent.futures
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'tools/coast-material-sources.json'

def main():
    folder = pathlib.Path(sys.argv[1]); folder.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text())
    ffmpeg = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
    def encode(item):
        source = folder / item['filename']
        if '--download' in sys.argv and not source.exists():
            subprocess.run(['curl', '-fsSL', '--retry', '2', item['url'], '-o', str(source)], check=True)
        if hashlib.md5(source.read_bytes()).hexdigest() != item['md5']:
            raise ValueError('Source checksum mismatch: ' + str(source))
        output = folder / (item['name'] + '-' + item['channel'] + '-packed.webp')
        command = [ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(source),
                   '-vf', 'scale={0}:{0}:flags=lanczos'.format(item['size']),
                   '-c:v', 'libwebp', '-compression_level', '6', '-q:v', str(item['quality']), '-pix_fmt', 'bgra' if item['channel'] == 'arm' else 'yuv420p']
        if item['channel'] == 'arm': command += ['-lossless', '1']
        subprocess.run(command + [str(output)], check=True)
        return item, 'data:image/webp;base64,' + base64.b64encode(output.read_bytes()).decode()
    data = {}
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for item, encoded in pool.map(encode, manifest['maps']):
            data.setdefault(item['name'], {'source': item['asset']})[item['channel']] = encoded
    water = manifest['water']; source = folder / water['filename']
    if '--download' in sys.argv and not source.exists():
        subprocess.run(['curl', '-fsSL', water['url'], '-o', str(source)], check=True)
    if hashlib.md5(source.read_bytes()).hexdigest() != water['md5']: raise ValueError('Water checksum mismatch')
    data['water'] = {'source': 'three.js-ocean', 'normal': 'data:image/jpeg;base64,' + base64.b64encode(source.read_bytes()).decode()}
    output = ROOT / 'assets/coast/surfaces.js'
    output.write_text('/* Local PBR scans. Sources and processing: ASSET-LICENSES.md. */\nwindow.BABA.CoastSurfaceData=' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(str(output), output.stat().st_size, 'bytes')

if __name__ == '__main__': main()
