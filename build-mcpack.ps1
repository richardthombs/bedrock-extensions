$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$distDir = Join-Path $root 'dist'

$packs = @(
    @{ Source = 'packs/behavior_pack'; Output = 'Protected-Base-Zones-BP.mcpack' },
    @{ Source = 'packs/mining_claims_behavior_pack'; Output = 'Mining-Claims-BP.mcpack' }
)

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

foreach ($pack in $packs) {
    $packRoot = Join-Path $root $pack.Source
    if (-not (Test-Path $packRoot)) {
        throw "Pack folder not found: $packRoot"
    }

    $zipPath = Join-Path $distDir (($pack.Output -replace '\.mcpack$', '.zip'))
    $mcpackPath = Join-Path $distDir $pack.Output

    Remove-Item -Force -ErrorAction Ignore $zipPath, $mcpackPath
    Compress-Archive -Path (Join-Path $packRoot '*') -DestinationPath $zipPath -Force
    Move-Item -Force $zipPath $mcpackPath

    Write-Host "Created: $mcpackPath"
}
