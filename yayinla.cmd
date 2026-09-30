@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>&1 || goto missing
where gh >nul 2>&1 || goto missing
if not exist .git (
  git init -b main || goto failed
)
git config user.name goktugkarpat || goto failed
git config user.email goktugkarpat@users.noreply.github.com || goto failed
for /f "delims=" %%B in ('git branch --show-current') do set "GAME_BRANCH=%%B"
if not "%GAME_BRANCH%"=="main" (
  echo Once main dalina gecmelisin.
  goto failed
)
gh auth status >nul 2>&1
if errorlevel 1 (
  gh auth login --hostname github.com --git-protocol https --web || goto failed
)
set "GAME_LOGIN="
for /f "delims=" %%U in ('gh api user --jq .login 2^>nul') do set "GAME_LOGIN=%%U"
if not "%GAME_LOGIN%"=="goktugkarpat" (
  echo Gonderim icin aktif GitHub hesabi goktugkarpat olmali.
  goto failed
)
git add -A || goto failed
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Kabir Azabi: guncelleme" || goto failed
)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  gh repo view goktugkarpat/bahtiyar-kabir-azabi >nul 2>&1
  if errorlevel 1 (
    gh repo create goktugkarpat/bahtiyar-kabir-azabi --public --source . --remote origin --push || goto failed
  ) else (
    git remote add origin https://github.com/goktugkarpat/bahtiyar-kabir-azabi.git || goto failed
    git push -u origin main || goto failed
  )
) else (
  for /f "delims=" %%R in ('git remote get-url origin') do if not "%%R"=="https://github.com/goktugkarpat/bahtiyar-kabir-azabi.git" goto wrongremote
  git push -u origin main || goto failed
)
gh api repos/goktugkarpat/bahtiyar-kabir-azabi/pages >nul 2>&1
if errorlevel 1 (
  gh api -X POST repos/goktugkarpat/bahtiyar-kabir-azabi/pages -f "source[branch]=main" -f "source[path]=/" >nul || goto failed
)
echo Oyun gonderildi: https://goktugkarpat.github.io/bahtiyar-kabir-azabi/
pause
exit /b 0
:missing
echo Git ve GitHub CLI gerekli.
goto failed
:wrongremote
echo origin adresi Kabir Azabi deposuyla eslesmiyor.
:failed
echo Gonderim tamamlanamadi. Yukaridaki aciklamayi kontrol et.
pause
exit /b 1
