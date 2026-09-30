#!/bin/zsh
cd "$(dirname "$0")"
game_ready() {
  /usr/bin/curl --connect-timeout 1 --max-time 1 -fsS http://localhost:8787/manifest.webmanifest 2>/dev/null | /usr/bin/grep -q 'Kabir Azabı'
}
open_game() {
  if [[ -d '/Applications/Microsoft Edge.app' ]]; then
    open -a 'Microsoft Edge' 'http://localhost:8787'
  else
    open 'http://localhost:8787'
  fi
}
if game_ready; then
  open_game
  exit 0
fi
launch_pid=$$
(
  for attempt in {1..40}; do
    kill -0 "$launch_pid" 2>/dev/null || exit 0
    if game_ready; then open_game; exit 0; fi
    sleep .25
  done
  print 'Oyun sunucusu henüz hazır değil. Terminaldeki hata mesajını kontrol et.'
) &
exec python3 serve.py
