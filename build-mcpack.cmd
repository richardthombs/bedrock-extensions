@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0build-mcpack.ps1"
if errorlevel 1 exit /b %errorlevel%
echo Done.
