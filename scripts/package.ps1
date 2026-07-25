$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

npm run build
if (-not $?) { throw "Build failed" }

$pkg = Get-Content (Join-Path $root "package.json") | ConvertFrom-Json
$version = $pkg.version

$dist = Join-Path $root "dist"
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dist "src") | Out-Null

Copy-Item (Join-Path $root "manifest.json") $dist
Copy-Item (Join-Path $root "ui.html") $dist
Copy-Item (Join-Path $root "src\code.js") (Join-Path $dist "src")
Copy-Item (Join-Path $root "INSTALL.md") $dist

$zipPath = Join-Path $root "component-sentinel-v$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $zipPath

Write-Host "Packaged: $zipPath"
