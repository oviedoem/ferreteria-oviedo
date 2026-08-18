@echo off
chcp 1252 >/dev/null
set PANEL_URL=https://ferreteria-oviedo.web.app
if exist "E:\navegadores-portables\chromium\chrome.exe" (
    start "" "E:\navegadores-portables\chromium\chrome.exe" --user-data-dir="E:\navegadores-portables\chromium-perfil" "%PANEL_URL%"
    exit /b
)
if exist "E:\navegadores-portables\firefox\FirefoxPortable.exe" (
    start "" "E:\navegadores-portables\firefox\FirefoxPortable.exe" "%PANEL_URL%"
    exit /b
)
start "" "%PANEL_URL%"
