# Drives an Android phone over adb for Ddalggak device QA (development build — share intents need it).
# Usage: powershell -File scripts/android-device.ps1 <shot NAME | tap TEXT | tapxy X Y | text | back | swipeup | swipedown | top>
# Screenshots go to .device/ (git-ignored). Never capture screens that show real receipts/messages; use synthetic data or 'text' instead.
# Requires adb (winget install Google.PlatformTools) and a USB-debugging-authorized device.
param([string]$cmd, [string]$arg = '', [string]$arg2 = '')
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
$D = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.device'))
New-Item -ItemType Directory -Force $D | Out-Null

# Foldables report several displays; default to the first one SurfaceFlinger lists (main screen).
$DISP = $env:DDALGGAK_DISPLAY
if (-not $DISP) {
  $first = adb shell dumpsys SurfaceFlinger --display-id | Select-Object -First 1
  if ($first -match '^Display (\d+)') { $DISP = $Matches[1] }
}

function Shot($name) {
  if ($DISP) { adb shell screencap -d $DISP -p /sdcard/cp.png | Out-Null } else { adb shell screencap -p /sdcard/cp.png | Out-Null }
  adb pull /sdcard/cp.png "$D\$name-full.png" | Out-Null
  adb shell rm /sdcard/cp.png | Out-Null
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile("$D\$name-full.png")
  $bmp = New-Object System.Drawing.Bitmap $img, ([int]($img.Width / 3)), ([int]($img.Height / 3))
  $img.Dispose()
  $bmp.Save("$D\$name.png"); $bmp.Dispose()
  "$D\$name.png"
}

function Dump() {
  adb shell uiautomator dump /sdcard/ui.xml | Out-Null
  adb pull /sdcard/ui.xml "$D\ui.xml" | Out-Null
  [xml]([IO.File]::ReadAllText("$D\ui.xml", [Text.Encoding]::UTF8))
}

function Find($text) {
  $x = Dump
  $nodes = $x.SelectNodes('//node') | Where-Object { $_.text -like "*$text*" -or $_.'content-desc' -like "*$text*" }
  $clickable = $nodes | Where-Object { $_.clickable -eq 'true' } | Select-Object -First 1
  if ($clickable) { $clickable } else { $nodes | Select-Object -First 1 }
}

function TapNode($n) {
  if (-not $n) { 'NOT FOUND'; return }
  $m = [regex]::Match($n.bounds, '\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
  $cx = ([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2
  $cy = ([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2
  adb shell input tap $cx $cy
  "tapped '$($n.text)$($n.'content-desc')' at $cx,$cy"
}

switch ($cmd) {
  'shot' { Shot $arg }
  'tap' { TapNode (Find $arg) }
  'tapxy' { adb shell input tap $arg $arg2; "tapped $arg,$arg2" }
  'text' {
    $x = Dump
    $x.SelectNodes('//node') | ForEach-Object { $t = $_.text; if (-not $t) { $t = $_.'content-desc' }; if ($t) { "$t  [$($_.bounds)]" } }
  }
  'back' { adb shell input keyevent 4 }
  'swipeup' { adb shell input swipe 540 1900 540 700 400 }
  'swipedown' { adb shell input swipe 540 700 540 1900 400 }
  'top' { adb shell dumpsys activity activities | Select-String -Pattern 'topResumedActivity' | ForEach-Object { $_.Line.Trim() } }
  default { 'usage: shot NAME | tap TEXT | tapxy X Y | text | back | swipeup | swipedown | top' }
}
