@echo off
chcp 65001 >nul
title 나스 영상 열기 설치
rem ============================================================================
rem  인트라넷 "광고 영상 리스트"의 ▶ 버튼으로 나스 영상을 바로 열기 위한 연결 프로그램 설치 (2026-11-09)
rem  - 웹 페이지는 보안상 나스(\\192.168.0.10) 파일을 직접 열 수 없어, 브라우저가 phbnas:// 주소를 이 PC 의 작은 프로그램에 넘기게 합니다.
rem  - 관리자 권한 없이 현재 사용자에게만 등록됩니다 (HKCU). 지우려면 이 파일을 "nas-open-setup.cmd remove" 로 실행.
rem  - 회사 네트워크에서 나스가 보이는 PC 에서만 동작합니다. 설치 뒤 브라우저가 "phb.kr 이 … 열려고 합니다" 하고 물으면 "항상 허용"에 체크하고 열기.
rem ============================================================================
set "D=%LOCALAPPDATA%\phb-nas"
if /i "%~1"=="remove" goto :remove
if not exist "%D%" mkdir "%D%"

rem --- 연결 프로그램 본체 (PowerShell). 브라우저가 넘긴 phbnas://open?p=<경로> 를 풀어 기본 재생 프로그램으로 엽니다
> "%D%\open.ps1" echo param([string]$u)
>>"%D%\open.ps1" echo Add-Type -AssemblyName System.Windows.Forms
>>"%D%\open.ps1" echo try {
>>"%D%\open.ps1" echo   $q = $u -replace '^phbnas:/*open/?\?p=', '' -replace '^phbnas:/*', ''
>>"%D%\open.ps1" echo   $q = $q.TrimEnd('/')
>>"%D%\open.ps1" echo   $p = [uri]::UnescapeDataString($q)
>>"%D%\open.ps1" echo   $p = $p.Replace('/', '\')
>>"%D%\open.ps1" echo   if ($p -notmatch '^\\\\') { $p = '\\' + $p.TrimStart('\') }
>>"%D%\open.ps1" echo   if (Test-Path -LiteralPath $p) { Start-Process -FilePath $p }
>>"%D%\open.ps1" echo   else { [System.Windows.Forms.MessageBox]::Show("나스에서 파일을 찾을 수 없습니다.`n`n$p`n`n회사 네트워크에 연결돼 있는지, 나스 로그인이 돼 있는지 확인하세요.", "나스 영상 열기") ^| Out-Null }
>>"%D%\open.ps1" echo } catch { [System.Windows.Forms.MessageBox]::Show("열지 못했습니다: $($_.Exception.Message)`n`n$u", "나스 영상 열기") ^| Out-Null }

rem --- phbnas:// 주소를 위 프로그램에 연결 (현재 사용자만)
reg add "HKCU\Software\Classes\phbnas" /ve /d "URL:PHB NAS Video" /f >nul
reg add "HKCU\Software\Classes\phbnas" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\phbnas\DefaultIcon" /ve /d "wmplayer.exe,0" /f >nul
reg add "HKCU\Software\Classes\phbnas\shell\open\command" /ve /d "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%D%\open.ps1\" \"%%1\"" /f >nul
if errorlevel 1 (
  echo.
  echo  [실패] 등록하지 못했습니다. 회사 IT 담당에게 문의하세요.
  pause & exit /b 1
)
echo.
echo  ======================================================
echo   나스 영상 열기 설치 완료
echo  ------------------------------------------------------
echo   인트라넷(phb.kr) 광고 영상 리스트에서 ▶ 를 누르면
echo   나스의 영상이 팟플레이어 등 기본 재생 프로그램으로 열립니다.
echo   처음 한 번 브라우저가 "열까요?" 하고 물으면
echo   "항상 허용"에 체크하고 [열기]를 누르세요.
echo  ======================================================
echo.
pause
exit /b 0

:remove
reg delete "HKCU\Software\Classes\phbnas" /f >nul 2>&1
if exist "%D%" rmdir /s /q "%D%"
echo  나스 영상 열기 연결을 지웠습니다.
pause
exit /b 0
