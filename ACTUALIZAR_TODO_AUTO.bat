@echo off
rem Lanzador de la corrida desatendida: hace lo mismo que ACTUALIZAR_TODO.bat (modo /auto: sin pausas ni preguntas, precios ocultos).
rem Version anterior (independiente, 341 lineas) en E:\_ARCHIVO_FERRETERIA\ferreteria-auto-respaldo-20261016.
call "%~dp0ACTUALIZAR_TODO.bat" /auto
exit /b %errorlevel%
