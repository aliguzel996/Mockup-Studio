[CmdletBinding()]
param(
  [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
trap {
  Write-Error $_
  exit 1
}

function Get-Sha256Hex([string]$Path) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    return -join ($algorithm.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') })
  } finally {
    $stream.Dispose()
    $algorithm.Dispose()
  }
}
$repoRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $repoRoot 'android'
$toolRoot = Join-Path $env:LOCALAPPDATA 'MotionfieldBuildTools'
$javaHome = Join-Path $toolRoot 'java\jdk-21.0.12.1+1'
$sdkRoot = Join-Path $toolRoot 'sdk'
$privateRoot = Join-Path $env:LOCALAPPDATA 'YCSWU\ResponsiveMockupStudio\signing'
$keystore = Join-Path $privateRoot 'responsive-mockup-studio-release.jks'
$secretFile = Join-Path $privateRoot 'release-password.dpapi'
$alias = 'responsive-mockup-studio'
$releaseRoot = Join-Path $repoRoot 'release\android'
$version = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
$versionCode = 13007

if (-not (Test-Path -LiteralPath (Join-Path $javaHome 'bin\java.exe'))) { throw "JDK bulunamadı: $javaHome" }
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'platforms\android-36\android.jar'))) { throw "Android SDK 36 bulunamadı: $sdkRoot" }

New-Item -ItemType Directory -Force -Path $privateRoot,$releaseRoot | Out-Null
if (-not (Test-Path -LiteralPath $secretFile) -or (Get-Item -LiteralPath $secretFile).Length -lt 20) {
  $random = New-Object byte[] 36
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($random) } finally { $generator.Dispose() }
  $plain = [Convert]::ToBase64String($random).TrimEnd('=').Replace('+','A').Replace('/','B')
  $plainBytes = [Text.Encoding]::Unicode.GetBytes($plain)
  try {
    $protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect($plainBytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $encryptedHex = -join ($protectedBytes | ForEach-Object { $_.ToString('x2') })
    $encryptedHex | Set-Content -LiteralPath $secretFile -Encoding ascii
  } finally {
    [Array]::Clear($plainBytes,0,$plainBytes.Length)
    $plain = $null
  }
}
$encryptedSecret = (Get-Content -LiteralPath $secretFile -Raw).Trim()
[byte[]]$protectedSecret = for ($index = 0; $index -lt $encryptedSecret.Length; $index += 2) {
  [Convert]::ToByte($encryptedSecret.Substring($index,2),16)
}
$plainSecret = [System.Security.Cryptography.ProtectedData]::Unprotect($protectedSecret,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
try { $password = [Text.Encoding]::Unicode.GetString($plainSecret) }
finally { [Array]::Clear($plainSecret,0,$plainSecret.Length) }

if (-not (Test-Path -LiteralPath $keystore)) {
  & (Join-Path $javaHome 'bin\keytool.exe') -genkeypair -v -keystore $keystore -storepass $password -keypass $password -alias $alias -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=YCSWU Responsive Mockup Studio, OU=YCSWU Tools, O=YCSWU, L=Istanbul, C=TR'
  if ($LASTEXITCODE -ne 0) { throw 'Android keystore üretilemedi.' }
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:RMS_ANDROID_KEYSTORE = $keystore
$env:RMS_ANDROID_STORE_PASSWORD = $password
$env:RMS_ANDROID_KEY_PASSWORD = $password
$env:RMS_ANDROID_KEY_ALIAS = $alias

try {
  Push-Location $repoRoot
  & npm.cmd run android:prepare
  if ($LASTEXITCODE -ne 0) { throw 'Android web varlıkları hazırlanamadı.' }
  New-Item -ItemType Directory -Force -Path (Join-Path $androidRoot 'app\src\main\res\drawable') | Out-Null
  Copy-Item -LiteralPath (Join-Path $repoRoot 'public\icon-512.png') -Destination (Join-Path $androidRoot 'app\src\main\res\drawable\ic_launcher.png') -Force
  "sdk.dir=$($sdkRoot.Replace('\','\\').Replace(':','\:'))" | Set-Content -LiteralPath (Join-Path $androidRoot 'local.properties') -Encoding ascii
  Pop-Location

  Push-Location $androidRoot
  & .\gradlew.bat clean assembleRelease bundleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Android release derlemesi başarısız.' }
  Pop-Location

  $apkSource = Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk'
  $aabSource = Join-Path $androidRoot 'app\build\outputs\bundle\release\app-release.aab'
  $apkTarget = Join-Path $releaseRoot "Responsive-Mockup-Studio-$version-$versionCode.apk"
  $aabTarget = Join-Path $releaseRoot "Responsive-Mockup-Studio-$version-$versionCode.aab"
  Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
  Copy-Item -LiteralPath $aabSource -Destination $aabTarget -Force

  $apksigner = Join-Path $sdkRoot 'build-tools\36.0.0\apksigner.bat'
  $aapt = Join-Path $sdkRoot 'build-tools\36.0.0\aapt.exe'
  $jarsigner = Join-Path $javaHome 'bin\jarsigner.exe'
  $keytool = Join-Path $javaHome 'bin\keytool.exe'
  $verify = (& $apksigner verify --verbose --print-certs $apkTarget 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw "APK imza doğrulaması başarısız: $verify" }
  $badging = (& $aapt dump badging $apkTarget 2>&1 | Select-Object -First 1 | Out-String).Trim()
  if ($badging -notmatch "package: name='co\.ycswu\.responsivemockupstudio'.*versionCode='$versionCode'.*versionName='$version'") { throw "APK kimlik/sürüm doğrulaması başarısız: $badging" }
  $aabVerify = (& $jarsigner -verify -certs $aabTarget 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw "AAB imza doğrulaması başarısız: $aabVerify" }
  $aabCertificate = (& $keytool -printcert -jarfile $aabTarget 2>&1 | Out-String).Trim()
  $aabCertificateMatch = [regex]::Match($aabCertificate, 'SHA256:\s*([0-9A-F:]+)', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($LASTEXITCODE -ne 0 -or -not $aabCertificateMatch.Success) { throw 'AAB sertifika bilgisi doğrulanamadı.' }
  $aabSignerSha256 = $aabCertificateMatch.Groups[1].Value.Replace(':','').ToLowerInvariant()
  $apkSignerSha256 = ((($verify -split "`r?`n") | Where-Object { $_ -match 'Signer #1 certificate SHA-256 digest' } | Select-Object -First 1) -split ':\s*')[-1].Trim().ToLowerInvariant()
  if ($aabSignerSha256 -ne $apkSignerSha256) { throw "APK/AAB imza kimliği eşleşmiyor: $apkSignerSha256 / $aabSignerSha256" }
  $aabVerify | Set-Content -LiteralPath (Join-Path $releaseRoot 'aab-jarsigner-verify.txt') -Encoding utf8
  $manifest = [ordered]@{
    product = 'Responsive Mockup Studio'
    version = $version
    versionCode = $versionCode
    applicationId = 'co.ycswu.responsivemockupstudio'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    physicalDeviceTested = $false
    signer = (($verify -split "`r?`n") | Where-Object { $_ -match 'Signer #1 certificate SHA-256 digest' } | Select-Object -First 1).Trim()
    aabSignerSha256 = $aabSignerSha256
    files = @(
      [ordered]@{ file = [IO.Path]::GetFileName($apkTarget); bytes = (Get-Item -LiteralPath $apkTarget).Length; sha256 = Get-Sha256Hex $apkTarget },
      [ordered]@{ file = [IO.Path]::GetFileName($aabTarget); bytes = (Get-Item -LiteralPath $aabTarget).Length; sha256 = Get-Sha256Hex $aabTarget }
    )
    apkBadging = $badging
    apkVerification = $verify
    aabVerification = 'jarsigner verification passed; APK and AAB signer SHA-256 identities match.'
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $releaseRoot "Responsive-Mockup-Studio-Android-$version.json") -Encoding utf8
  Write-Host "APK=$apkTarget"
  Write-Host "AAB=$aabTarget"
} finally {
  $password = $null
  Remove-Item Env:RMS_ANDROID_STORE_PASSWORD,Env:RMS_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
  if ((Get-Location).Path -ne $repoRoot) { Pop-Location -ErrorAction SilentlyContinue }
}
