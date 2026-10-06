"""Combat balance bench runner (QA only). Drives src/combat-balance.js (BABA.Balance.run) in headless Chrome.

Usage (from the project folder):
    python tools/combat_balance.py 1,2,3,4 easy,normal,hard novice,average,skilled,spam [encounters] [level] [--json out.json]
      encounters: all (default) | boss | 0,3,5     level: 0 = expected level of the chapter (3 / 6 / 9 / 11)
Needs: Python 3.11 + playwright (Chrome channel). One page per chapter; the game always opens muted (?sessiz).
Prints one summary line per difficulty x bot and one line per fight. See the header of src/combat-balance.js for the fields.
"""
import functools, http.server, json, os, socket, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def run_chapter(pw, base, ch, diffs, bots, enc, level, out):
    browser = pw.chromium.launch(channel='chrome', headless=True, args=['--mute-audio', '--ignore-gpu-blocklist'])
    try:
        ctx = browser.new_context(viewport={'width': 640, 'height': 360})
        if ch > 1:   # a fresh profile entering chapter ch (the bench sets level and gear itself)
            seed = ctx.new_page(); seed.goto(base + 'credits.html')
            camp = {'version': 3, 'chapter': ch, 'index': 0, 'transition': True,
                    'progression': {'version': 2, 'level': 1, 'xp': 0, 'points': 0, 'inventory': [], 'equipment': {}, 'completed': list(range(1, ch))}}
            seed.evaluate("c => localStorage.setItem('baba.kabir.campaign.v1', JSON.stringify(c))", camp); seed.close()
        page = ctx.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(base + 'index.html?sessiz' + ('&yolculuk=devam' if ch > 1 else ''))
        page.wait_for_function('window.BABA && BABA.app && BABA.app.view && !BABA.app.warming', timeout=300000)
        page.evaluate("BABA.app.view === 'title' && BABA.app.begin(false)"); page.evaluate('BABA.app.step(8)')
        enc_js = json.dumps(enc if enc in ('all', 'boss') else [int(x) for x in enc.split(',')])
        for d in diffs:
            for b in bots:
                r = json.loads(page.evaluate(f"JSON.stringify(BABA.Balance.run({{difficulty:'{d}', bot:'{b}', encounters:{enc_js}, level:{level}, seed:3}}))"))
                out.append(r); T, P = r['total'], r['profile']
                print(f"ch{ch} {d:6} {b:8} L{P['level']} dmg{P['dmg']} hp{P['hp']} def{P['def']} | fights {T['fights']} deaths {T['deaths']} timeouts {T['timeouts']} "
                      f"time {T['time']}s hpLost {T['hpLost']} flasks {T['flasks']} rolls {T['rolls']} hits {T['hitsTaken']} denied {T['denied']} perfect {T['perfect']}", flush=True)
                for x in r['results']:
                    state = 'DIED' if x['died'] else 'ok  ' if x['cleared'] else 'TIME'
                    print(f"   #{x['index']:2} {'B' if x['boss'] else ' '} {x['types'][:46]:46} {state} t{x['fightTime']:6} hp-{x['hpLost']:4} fl{x['flasks']} rl{x['rolls']:3} hits{x['hitsTaken']:3} max{x['biggestHit']}", flush=True)
        print('page errors', errors[:4], flush=True)
    finally:
        browser.close()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out_path = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
    if out_path in args: args.remove(out_path)
    chapters = [int(c) for c in (args[0] if args else '1').split(',')]
    diffs = (args[1] if len(args) > 1 else 'normal').split(',')
    bots = (args[2] if len(args) > 2 else 'average').split(',')
    enc = args[3] if len(args) > 3 else 'all'
    level = int(args[4]) if len(args) > 4 else 0
    port = free_port()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = []
    try:
        with sync_playwright() as pw:
            for ch in chapters:
                t0 = time.time(); run_chapter(pw, f'http://127.0.0.1:{port}/', ch, diffs, bots, enc, level, out)
                print(f'chapter {ch}: {round(time.time() - t0)} s', flush=True)
    finally:
        srv.shutdown()
    if out_path:
        with open(out_path, 'w', encoding='utf-8') as f: json.dump(out, f)


if __name__ == '__main__':
    main()
