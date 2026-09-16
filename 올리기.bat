@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================
echo  인트라넷 파일을 GitHub 에 올립니다 (1~2분 뒤 인터넷 주소에 반영)
echo ==============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bump.ps1"
git add -A
git diff --cached --quiet && echo (새로 바뀐 파일 없음. 저장된 내용을 그대로 올립니다) || git commit -m "화면 수정 (올리기.bat)"
git push
if errorlevel 1 (
  echo.
  echo !!! 올리기에 실패했습니다. 인터넷 연결이나 GitHub 로그인을 확인하세요.
) else (
  echo.
  echo 완료. 1~2분 뒤 https://phb.kr/ 에서 Ctrl+Shift+R 로 새로고침하세요.
)
echo.
pause
