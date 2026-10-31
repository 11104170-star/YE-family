@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 葉氏家族族譜 - 本地預覽
set "YEH_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined YEH_NODE set "YEH_NODE=%%N"
if not defined YEH_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "YEH_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined YEH_NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "YEH_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined YEH_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "YEH_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined YEH_NODE goto missing_node
if not exist "scripts\serve.mjs" goto missing_files
if not exist "data\family.json" goto missing_files
if /i "%~1"=="--check" goto check
echo 正在啟動葉氏家族族譜，瀏覽器將自動開啟。
echo 請保留此視窗，關閉視窗即可停止預覽。
echo.
set "PORT=0"
"%YEH_NODE%" "scripts\serve.mjs" --open
if errorlevel 1 goto failed
exit /b 0
:check
"%YEH_NODE%" --check "scripts\serve.mjs"
if errorlevel 1 goto failed
"%YEH_NODE%" "scripts\validate-data.mjs"
if errorlevel 1 goto failed
echo 啟動檢查通過。
exit /b 0
:missing_node
echo 找不到 Node.js，請先安裝 Node.js 22 或更新版本，再重新執行。
echo 官方下載：https://nodejs.org/
goto failed
:missing_files
echo 找不到網站檔案，請將此 BAT 放在完整專案資料夾內，不要單獨移動。
:failed
echo.
echo 預覽未能啟動，請查看上方訊息。
pause
exit /b 1
