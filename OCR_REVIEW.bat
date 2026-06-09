@echo off
chcp 1252 >nul
title OCR Review -- Ferreteria Oviedo

:: ============================================================
:: OCR_REVIEW.bat -- Revision de codigo con open-code-review
:: Uso: Ejecutar antes de cada deploy para auditar los cambios
:: Equivalente Claude Code: /open-code-review
:: ============================================================

set NODE_EXE=node
set OCR_EXE=ocr

if exist "E:\nodejs-portable\node.exe" (
    set NODE_EXE=E:\nodejs-portable\node.exe
    set PATH=E:\nodejs-portable;E:\npm-global;%PATH%
)

:: Verificar que ocr este disponible
where ocr >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Comando 'ocr' no encontrado.
    echo Verificar que E:\npm-global este en el PATH.
    echo Instalar con: npm install -g @alibaba-group/open-code-review
    echo.
    pause
    exit /b 1
)

:: ============================================================
:: PASO 1 -- Ejecutar revision de codigo
:: ============================================================
echo.
echo ============================================================
echo  OPEN CODE REVIEW -- Ferreteria Oviedo El Manzano
echo ============================================================
echo  Revisando cambios desde main hasta HEAD...
echo  Idioma de reporte: Spanish
echo  Modelo: claude-sonnet-4-6
echo ============================================================
echo.

ocr review --from main --to HEAD --audience human

:: ============================================================
:: PASO 2 -- Resultado y decision de deploy
:: ============================================================
echo.
echo ============================================================
echo  REVISION COMPLETADA
echo ============================================================
echo.
echo Revisa los hallazgos antes de continuar.
echo Errores FO-001 a FO-003: BLOQUEAN el deploy (seguridad)
echo Warnings FO-004+: revisar caso a caso
echo.

set /p DEPLOY="Continuar con el deploy? (S=Si, N=No/Abortar) [N]: "
if /i "%DEPLOY%"=="S" goto :ejecutar_deploy
if /i "%DEPLOY%"=="s" goto :ejecutar_deploy

echo.
echo [ABORTADO] Deploy cancelado por el operador.
echo Corrige los hallazgos y vuelve a ejecutar OCR_REVIEW.bat
echo.
pause
exit /b 0

:ejecutar_deploy
echo.
echo [OK] Iniciando deploy...
echo.
call "E:\ferreteria-oviedo\ACTUALIZAR_GITHUB.bat"
exit /b %errorlevel%
