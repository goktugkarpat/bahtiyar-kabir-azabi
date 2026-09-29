#!/bin/zsh
cd "$(dirname "$0")"
if /usr/bin/curl -fsS http://localhost:8787/manifest.webmanifest 2>/dev/null | /usr/bin/grep -q 'Kabir Azabı'; then
  if [[ -d '/Applications/Microsoft Edge.app' ]]; then
    open -a 'Microsoft Edge' 'http://localhost:8787'
  else
    open 'http://localhost:8787'
  fi
  exit 0
fi
(sleep 1; if [[ -d '/Applications/Microsoft Edge.app' ]]; then open -a 'Microsoft Edge' 'http://localhost:8787'; else open 'http://localhost:8787'; fi) &
exec python3 serve.py
