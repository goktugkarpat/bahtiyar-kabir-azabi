#!/bin/zsh
set -eu
cd "$(dirname "$0")"
game_root="$PWD"
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ "$repo_root" != "$game_root" ]]; then
  git init -b main
fi
git config user.name 'goktugkarpat'
git config user.email 'goktugkarpat@users.noreply.github.com'
if [[ "$(git branch --show-current)" != 'main' ]]; then
  print 'Yayımlamak için önce main dalına geçmelisin.'
  exit 1
fi
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web
git add -A
if ! git diff --cached --quiet; then
  git commit -m 'Kabir Azabi: guncelleme'
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  if gh repo view goktugkarpat/bahtiyar-kabir-azabi >/dev/null 2>&1; then
    git remote add origin https://github.com/goktugkarpat/bahtiyar-kabir-azabi.git
    git push -u origin main
  else
    gh repo create goktugkarpat/bahtiyar-kabir-azabi --public --source . --remote origin --push
  fi
else
  if [[ "$(git remote get-url origin)" != 'https://github.com/goktugkarpat/bahtiyar-kabir-azabi.git' ]]; then
    print 'origin adresi Kabir Azabi deposuyla eslesmiyor.'
    exit 1
  fi
  git push -u origin main
fi
if ! gh api repos/goktugkarpat/bahtiyar-kabir-azabi/pages >/dev/null 2>&1; then
  gh api -X POST repos/goktugkarpat/bahtiyar-kabir-azabi/pages -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi
print 'Oyun gonderildi: https://goktugkarpat.github.io/bahtiyar-kabir-azabi/'
