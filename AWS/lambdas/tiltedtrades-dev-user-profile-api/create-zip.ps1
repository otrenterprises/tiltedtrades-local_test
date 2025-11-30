$ErrorActionPreference = "Stop"

$tempDir = "temp_package"
$zipFile = "lambda.zip"

# Clean up
Remove-Item $zipFile -ErrorAction SilentlyContinue
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Create directory structure
New-Item -ItemType Directory -Force -Path "$tempDir/user-profile-api/src" | Out-Null
New-Item -ItemType Directory -Force -Path "$tempDir/shared/types" | Out-Null

# Copy files (copy entire src directory contents, not just files)
Copy-Item "user-profile-api/src/*" -Destination "$tempDir/user-profile-api/src/" -Recurse -Force
Copy-Item "shared/types/*" -Destination "$tempDir/shared/types/" -Recurse -Force

# Create zip
Compress-Archive -Path "$tempDir/*" -DestinationPath $zipFile -Force

# Clean up temp
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Lambda zip created successfully: $zipFile"
