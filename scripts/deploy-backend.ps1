$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$stageRoot = Join-Path $env:TEMP ('payshield-functions-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stageRoot | Out-Null
foreach ($folder in @('netlify', 'netlify-static')) { Copy-Item -LiteralPath (Join-Path $projectRoot $folder) -Destination $stageRoot -Recurse }
foreach ($file in @('netlify.toml', 'package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $stageRoot }
# A fresh functions-only stage excludes stale Next.js handlers and local secrets.
Push-Location $projectRoot
try {
    $outputArgument = '--outdir=' + (Join-Path $stageRoot 'netlify/functions')
    npx esbuild netlify/functions/cases.mjs netlify/functions/voice.mjs --bundle --platform=node --format=esm $outputArgument --out-extension:.js=.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Function bundling failed.' }
} finally { Pop-Location }
Push-Location $stageRoot
try {
    npx --yes netlify@27.8.0 deploy --no-build --dir netlify-static --functions netlify/functions --prod --site 211de129-a360-4cf7-8f2d-3f9c3eaec2f0 --message 'PayShield sender reports and investigator case desk'
    if ($LASTEXITCODE -ne 0) { throw 'Netlify deployment failed.' }
} finally { Pop-Location }
