@echo off
rem Aula en Red - Punto Digital: arranca el servidor en produccion y abre el panel del profe.
chcp 65001 >nul
title Aula en Red - Punto Digital
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No se encontro Node.js en esta compu.
  echo  Instalalo ^(version 20 o mas nueva^) y volve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

if not exist "server\dist\index.js" goto falta_build
if not exist "client\dist\index.html" goto falta_build

set NODE_ENV=production

rem Abre /profe unos segundos despues, cuando el servidor ya esta escuchando.
start "" /b cmd /c "ping -n 4 127.0.0.1 >nul && start http://localhost:3000/profe"

node server\dist\index.js

echo.
echo  El servidor se detuvo. Cerra esta ventana o volve a abrir iniciar.bat.
pause
exit /b 0

:falta_build
echo.
echo  Falta el build de la app.
echo  En casa, con internet, abri una terminal en esta carpeta y corre:
echo.
echo      npm install
echo      npm run build
echo.
pause
exit /b 1
