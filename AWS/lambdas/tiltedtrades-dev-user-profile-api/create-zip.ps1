$ErrorActionPreference = "Stop"

$tempDir = "temp_package"
$zipFile = "lambda.zip"

# Clean up
Remove-Item $zipFile -ErrorAction SilentlyContinue
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Create directory structure
# Note: shared/types/config.js is now provided by the shared-config Lambda Layer
New-Item -ItemType Directory -Force -Path "$tempDir/user-profile-api/src/routes" | Out-Null

# Copy files (copy entire src directory contents)
Copy-Item "user-profile-api/src/*" -Destination "$tempDir/user-profile-api/src/" -Recurse -Force

# Create zip
Compress-Archive -Path "$tempDir/*" -DestinationPath $zipFile -Force

# Clean up temp
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Lambda zip created successfully: $zipFile"
Write-Host "Note: Remember to attach the 'tiltedtrades-shared-config' layer to this Lambda function"
