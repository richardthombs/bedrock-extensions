$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$packRoot = Join-Path $root 'packs/behavior_pack'
$distDir = Join-Path $root 'dist'
$zipPath = Join-Path $distDir 'Protected-Base-Zones-BP.zip'
$mcpackPath = Join-Path $distDir 'Protected-Base-Zones-BP.mcpack'

if (-not (Test-Path $packRoot)) {
    throw "Pack folder not found: $packRoot"
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Remove-Item -Force -ErrorAction Ignore $zipPath, $mcpackPath

Compress-Archive -Path (Join-Path $packRoot '*') -DestinationPath $zipPath -Force
Move-Item -Force $zipPath $mcpackPath

Write-Host "Created: $mcpackPath"
