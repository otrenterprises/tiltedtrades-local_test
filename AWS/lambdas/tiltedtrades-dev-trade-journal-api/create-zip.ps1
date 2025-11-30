$ErrorActionPreference = "Stop"

$tempDir = "temp_package"
$zipFile = "lambda.zip"

# Clean up
Remove-Item $zipFile -ErrorAction SilentlyContinue
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Create directory structure matching the original require paths
# index.js requires ../../shared/types/config
# So from trade-journal-api/src/index.js, it goes to shared/types/config
New-Item -ItemType Directory -Force -Path "$tempDir/trade-journal-api/src" | Out-Null
New-Item -ItemType Directory -Force -Path "$tempDir/shared/types" | Out-Null

# Copy files
Copy-Item "trade-journal-api/src/*" -Destination "$tempDir/trade-journal-api/src/" -Recurse -Force
Copy-Item "shared/types/*" -Destination "$tempDir/shared/types/" -Recurse -Force

# Create zip
Compress-Archive -Path "$tempDir/*" -DestinationPath $zipFile -Force

# Clean up temp
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Lambda zip created successfully: $zipFile"
