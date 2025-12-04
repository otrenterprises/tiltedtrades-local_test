$ErrorActionPreference = "Stop"

$layerName = "tiltedtrades-shared-config"
$zipFile = "shared-config-layer.zip"
$region = "us-east-1"

Write-Host "Deploying shared-config Lambda Layer..."

# Check if zip exists
if (-not (Test-Path $zipFile)) {
    Write-Host "Creating layer zip..."
    Compress-Archive -Path nodejs -DestinationPath $zipFile -Force
}

# Publish new layer version
Write-Host "Publishing layer to AWS..."
$result = aws lambda publish-layer-version `
    --layer-name $layerName `
    --description "Shared configuration for TiltedTrades Lambda functions" `
    --zip-file "fileb://$zipFile" `
    --compatible-runtimes nodejs18.x nodejs20.x `
    --region $region `
    --output json | ConvertFrom-Json

$layerArn = $result.LayerVersionArn
Write-Host "Layer published: $layerArn"

# Output the layer ARN for reference
Write-Host ""
Write-Host "To attach this layer to a Lambda function, run:"
Write-Host "aws lambda update-function-configuration --function-name YOUR_FUNCTION --layers $layerArn"
Write-Host ""
Write-Host "Lambda functions to update:"
Write-Host "  - tiltedtrades-dev-post-registration-trigger"
Write-Host "  - tiltedtrades-dev-public-profiles-api"
Write-Host "  - tiltedtrades-dev-file-upload-handler"
Write-Host "  - tiltedtrades-dev-user-profile-api"
Write-Host "  - tiltedtrades-dev-trade-journal-api"
Write-Host "  - tiltedtrades-dev-stats-calculator"
Write-Host "  - tiltedtrades-dev-trading-data-processor"
