# 공통 파일(common.js, common.css) 주소 뒤 버전 표시를 지금 시각으로 바꿉니다.
# 브라우저가 옛 파일을 기억(캐시)해서 새 화면과 짝이 안 맞는 일을 막습니다. 올리기.bat 이 자동으로 실행합니다.
$v = Get-Date -Format 'yyyyMMddHHmm'
Get-ChildItem "$PSScriptRoot\*.html" | ForEach-Object {
  $t = [IO.File]::ReadAllText($_.FullName)
  $n = $t -replace 'common\.(js|css)(\?v=\d+)?"', ('common.$1?v=' + $v + '"')
  if ($n -ne $t) { [IO.File]::WriteAllText($_.FullName, $n, (New-Object Text.UTF8Encoding $false)) }
}
Write-Host "버전 표시: $v"
