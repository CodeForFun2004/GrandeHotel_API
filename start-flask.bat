@echo off
echo ============================================
echo [Flask] Starting Flask AI Server...
echo ============================================
cd /d %~dp0
call C:\Users\Lenovo\miniconda3\condabin\conda.bat activate face310 && python ai-service\flaskserver.py



