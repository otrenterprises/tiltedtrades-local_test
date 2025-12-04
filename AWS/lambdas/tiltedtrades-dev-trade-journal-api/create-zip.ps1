$ErrorActionPreference = "Stop"

$tempDir = "temp_package"
$zipFile = "lambda.zip"

# Clean up
Remove-Item $zipFile -ErrorAction SilentlyContinue
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Create directory structure
# Note: shared/types/config.js is now provided by the shared-config Lambda Layer
New-Item -ItemType Directory -Force -Path "$tempDir/trade-journal-api/src/routes" | Out-Null
New-Item -ItemType Directory -Force -Path "$tempDir/trade-journal-api/src/utils" | Out-Null

# Copy files
Copy-Item "trade-journal-api/src/index.js" -Destination "$tempDir/trade-journal-api/src/" -Force
Copy-Item "trade-journal-api/src/routes/*" -Destination "$tempDir/trade-journal-api/src/routes/" -Recurse -Force
Copy-Item "trade-journal-api/src/utils/*" -Destination "$tempDir/trade-journal-api/src/utils/" -Recurse -Force

# Create zip
Compress-Archive -Path "$tempDir/*" -DestinationPath $zipFile -Force

# Clean up temp
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Lambda zip created successfully: $zipFile"
Write-Host "Note: Remember to attach the 'tiltedtrades-shared-config' layer to this Lambda function"
