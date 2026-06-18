# Run this AFTER: npx cap add android
# It adds the native HTTP plugin to the Android project

$androidDir = "$PSScriptRoot/../artifacts/music-player/android"
if (-not (Test-Path $androidDir)) {
  Write-Host "Android project not found. Run 'npx cap add android' first." -ForegroundColor Red
  exit 1
}

# Find MainActivity.java (package may vary)
$mainActivity = Get-ChildItem -Path $androidDir -Recurse -Filter "MainActivity.java" | Select-Object -First 1
if (-not $mainActivity) {
  Write-Host "MainActivity.java not found" -ForegroundColor Red
  exit 1
}

$pluginDir = $mainActivity.DirectoryName + "/plugins"
$pluginFile = "$pluginDir/NativeHttpPlugin.java"

# Create plugins directory
New-Item -ItemType Directory -Force -Path $pluginDir

# Copy the plugin
Copy-Item "$PSScriptRoot/../plugins/native-http/android/src/main/java/com/sanctuary/musicplayer/plugins/NativeHttpPlugin.java" -Destination $pluginFile

Write-Host "NativeHttpPlugin.java copied" -ForegroundColor Green

# Read MainActivity.java
$content = Get-Content $mainActivity.FullName -Raw

# Check if plugin is already registered
if ($content -match "NativeHttpPlugin") {
  Write-Host "Plugin already registered" -ForegroundColor Yellow
} else {
  # Add import
  $importLine = "import com.sanctuary.musicplayer.plugins.NativeHttpPlugin;"
  if ($content -notmatch $importLine) {
    # Find last import line and add after it
    $newContent = $content -replace "(import com\.getcapacitor\.BridgeActivity;)", "`$1`nimport com.sanctuary.musicplayer.plugins.NativeHttpPlugin;"
    $content = $newContent
  }

  # Add registration in onCreate
  $newContent = $content -replace "(super\.onCreate\(savedInstanceState\);)", "    registerPlugin(NativeHttpPlugin.class);`n    `$1"
  $content = $newContent

  Set-Content -Path $mainActivity.FullName -Value $content -NoNewline
  Write-Host "Plugin registered in MainActivity.java" -ForegroundColor Green
}

# Also copy the plugin def to the correct package dir if needed
$expectedDir = "$androidDir/app/src/main/java/com/sanctuary/musicplayer"
if ((Get-ChildItem -Path "$androidDir/app/src" -Recurse -Filter "*.java" | Select-Object -First 1) -and (-not (Test-Path "$expectedDir/plugins/NativeHttpPlugin.java"))) {
  $pkgDir = Get-ChildItem -Path "$androidDir/app/src" -Recurse -Directory -Filter "com" | Select-Object -First 1
  if ($pkgDir) {
    $targetDir = "$pkgDir/sanctuary/musicplayer/plugins"
    New-Item -ItemType Directory -Force -Path $targetDir
    Copy-Item "$PSScriptRoot/../plugins/native-http/android/src/main/java/com/sanctuary/musicplayer/plugins/NativeHttpPlugin.java" -Destination "$targetDir/NativeHttpPlugin.java" -Force
    Write-Host "Plugin also copied to $targetDir" -ForegroundColor Green
  }
}

Write-Host "Android native HTTP plugin setup complete!" -ForegroundColor Green
Write-Host "Next: npx cap sync && npx cap open android"
