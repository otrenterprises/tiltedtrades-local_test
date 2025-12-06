# API Masking & Custom Domain Implementation Plan

## Overview
Mask AWS-specific identifiers from frontend users by implementing custom domains for API Gateway and S3/CloudFront.

---

## Current State Analysis

### What's Currently Exposed to Users (via Browser DevTools)

| Resource | Current Value | Visible In |
|----------|---------------|------------|
| API Gateway URL | `https://dls0o6mkhg.execute-api.us-east-1.amazonaws.com/dev` | Network requests |
| S3 Bucket Name | `tiltedtrades-dev-filebucket-427687728291` | Image URLs |
| Cognito User Pool ID | `us-east-1_VePlciWu5` | Auth requests |
| Cognito Client ID | `78tbqlscvaa6lgomedi7001qfg` | Auth requests |

### Risk Assessment
- **API Gateway URL**: Medium risk - exposes AWS account region and random API ID
- **S3 Bucket Name**: Medium risk - exposes bucket name with account ID
- **Cognito IDs**: Low risk - these are designed to be public (like OAuth client IDs)

---

## AWS Resources Inventory

### Route 53 Hosted Zone
```
Domain: tiltedtrades.com
Hosted Zone ID: Z01761811HIMK6DU561T0
```

### API Gateway
```
API Name: tiltedtrades-dev-api
API ID: dls0o6mkhg
Current URL: https://dls0o6mkhg.execute-api.us-east-1.amazonaws.com/dev
Stage: dev
```

### Amplify (DO NOT MODIFY)
```
App Name: tiltedtrades-app
App ID: dcbg7cxozpf1g
Domain: app.tiltedtrades.com
Certificate: AMPLIFY_MANAGED (handled automatically by Amplify)
CloudFront: d1cupt5mvtevz6.cloudfront.net
```

### S3 Bucket
```
Bucket Name: tiltedtrades-dev-filebucket-427687728291
Region: us-east-1
Used For: Chart images in journal entries
Current URL Pattern: https://tiltedtrades-dev-filebucket-427687728291.s3.us-east-1.amazonaws.com/{s3Key}
```

### Existing ACM Certificates
- No certificate exists for tiltedtrades.com subdomains (Amplify manages its own internally)
- Safe to create new certificates for `api.` and `cdn.` subdomains

---

## Implementation Plan (Priority Order)

### Phase 1: Custom Domain for API Gateway

**Goal**: Change `https://dls0o6mkhg.execute-api.us-east-1.amazonaws.com/dev` to `https://api.tiltedtrades.com`

#### Step 1.1: Create ACM Certificate
```bash
# Request certificate for api.tiltedtrades.com
aws acm request-certificate \
  --domain-name "api.tiltedtrades.com" \
  --validation-method DNS \
  --region us-east-1

# Note the CertificateArn from output - needed for next steps
```

#### Step 1.2: Get DNS Validation Record
```bash
# Get the CNAME record needed for validation
aws acm describe-certificate \
  --certificate-arn <CERTIFICATE_ARN> \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
  --region us-east-1
```

#### Step 1.3: Create DNS Validation Record in Route 53
```bash
# Create the validation CNAME record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z01761811HIMK6DU561T0 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "<VALIDATION_NAME>",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<VALIDATION_VALUE>"}]
      }
    }]
  }'
```

#### Step 1.4: Wait for Certificate Validation
```bash
# Check certificate status (wait for ISSUED)
aws acm describe-certificate \
  --certificate-arn <CERTIFICATE_ARN> \
  --query "Certificate.Status" \
  --region us-east-1

# Or wait automatically
aws acm wait certificate-validated \
  --certificate-arn <CERTIFICATE_ARN> \
  --region us-east-1
```

#### Step 1.5: Create Custom Domain in API Gateway
```bash
# Create the custom domain name (REGIONAL endpoint)
aws apigateway create-domain-name \
  --domain-name "api.tiltedtrades.com" \
  --regional-certificate-arn <CERTIFICATE_ARN> \
  --endpoint-configuration types=REGIONAL \
  --security-policy TLS_1_2

# Note the regionalDomainName from output (e.g., d-xxxxx.execute-api.us-east-1.amazonaws.com)
```

#### Step 1.6: Create Base Path Mapping
```bash
# Map the custom domain to your API stage
aws apigateway create-base-path-mapping \
  --domain-name "api.tiltedtrades.com" \
  --rest-api-id dls0o6mkhg \
  --stage dev \
  --base-path "(none)"
```

#### Step 1.7: Create Route 53 Alias Record
```bash
# Point api.tiltedtrades.com to API Gateway's regional domain
aws route53 change-resource-record-sets \
  --hosted-zone-id Z01761811HIMK6DU561T0 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.tiltedtrades.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z1UJRXOUMOOFQ8",
          "DNSName": "<REGIONAL_DOMAIN_NAME>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```
Note: `Z1UJRXOUMOOFQ8` is the hosted zone ID for API Gateway in us-east-1.

#### Step 1.8: Update Frontend Configuration
```bash
# Update .env.production
VITE_API_BASE_URL=https://api.tiltedtrades.com
```

Files to update:
- `.env.production` - change VITE_API_BASE_URL
- `.env.local` - change VITE_API_BASE_URL (for local testing against prod API)

---

### Phase 2: CloudFront for S3 (CDN for Images)

**Goal**: Change `https://tiltedtrades-dev-filebucket-427687728291.s3.us-east-1.amazonaws.com/...` to `https://cdn.tiltedtrades.com/...`

#### Step 2.1: Create ACM Certificate for CDN
```bash
# Request certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name "cdn.tiltedtrades.com" \
  --validation-method DNS \
  --region us-east-1
```

#### Step 2.2: Validate Certificate (same process as Phase 1)

#### Step 2.3: Create CloudFront Origin Access Control
```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "tiltedtrades-s3-oac",
    "Description": "OAC for tiltedtrades S3 bucket",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }'
```

#### Step 2.4: Create CloudFront Distribution
```bash
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "tiltedtrades-cdn-'$(date +%s)'",
    "Comment": "CDN for TiltedTrades chart images",
    "Enabled": true,
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-tiltedtrades-bucket",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": ["GET", "HEAD"],
      "CachedMethods": ["GET", "HEAD"],
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "Compress": true
    },
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "S3-tiltedtrades-bucket",
        "DomainName": "tiltedtrades-dev-filebucket-427687728291.s3.us-east-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "OriginAccessControlId": "<OAC_ID>"
      }]
    },
    "Aliases": {
      "Quantity": 1,
      "Items": ["cdn.tiltedtrades.com"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "<CDN_CERTIFICATE_ARN>",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "DefaultRootObject": "",
    "PriceClass": "PriceClass_100"
  }'
```

#### Step 2.5: Update S3 Bucket Policy
```bash
# Allow CloudFront to access the bucket
aws s3api put-bucket-policy \
  --bucket tiltedtrades-dev-filebucket-427687728291 \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tiltedtrades-dev-filebucket-427687728291/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::427687728291:distribution/<DISTRIBUTION_ID>"
        }
      }
    }]
  }'
```

#### Step 2.6: Create Route 53 Record for CDN
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z01761811HIMK6DU561T0 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "cdn.tiltedtrades.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "<CLOUDFRONT_DOMAIN>.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```
Note: `Z2FDTNDATAQYW2` is the hosted zone ID for all CloudFront distributions.

#### Step 2.7: Update Frontend Code
File: `src/components/journal/ChartGallery.tsx` (line 99)

Change:
```typescript
return `https://${config.s3.bucketName}.s3.${config.s3.region}.amazonaws.com/${chart.s3Key}`
```

To:
```typescript
return `https://cdn.tiltedtrades.com/${chart.s3Key}`
```

Or update environment config to use CDN URL.

---

### Phase 3: CloudFront in Front of API Gateway (Optional Enhancement)

**Benefits**: Additional caching, WAF integration, DDoS protection
**Complexity**: Higher - requires careful cache configuration for API responses

This phase is optional and can be deferred. The custom domain in Phase 1 already hides the AWS identifiers.

---

### Phase 4: Cognito Custom Domain (Optional)

**Note**: Cognito IDs are designed to be public. This is lowest priority and only for branding purposes.

If desired later:
```bash
aws cognito-idp create-user-pool-domain \
  --user-pool-id us-east-1_VePlciWu5 \
  --domain "auth" \
  --custom-domain-config CertificateArn=<AUTH_CERT_ARN>
```

---

## Post-Implementation Checklist

- [ ] Phase 1: API Gateway custom domain working
  - [ ] ACM certificate issued for api.tiltedtrades.com
  - [ ] Custom domain created in API Gateway
  - [ ] Base path mapping configured
  - [ ] Route 53 alias record created
  - [ ] Frontend .env updated
  - [ ] Test: `curl https://api.tiltedtrades.com/health` returns 200
  - [ ] Test: App functions correctly with new API URL

- [ ] Phase 2: CloudFront CDN for S3
  - [ ] ACM certificate issued for cdn.tiltedtrades.com
  - [ ] CloudFront distribution created
  - [ ] Origin Access Control configured
  - [ ] S3 bucket policy updated
  - [ ] Route 53 alias record created
  - [ ] Frontend code updated to use CDN URL
  - [ ] Test: Chart images load from cdn.tiltedtrades.com

---

## Rollback Plan

If issues occur, revert by:
1. Change `VITE_API_BASE_URL` back to direct API Gateway URL
2. Change S3 URL generation back to direct S3 URL
3. DNS changes can remain (won't affect anything if not used)

---

## Files to Modify

| File | Change |
|------|--------|
| `.env.production` | `VITE_API_BASE_URL=https://api.tiltedtrades.com` |
| `.env.local` | Same as above (optional, for local prod testing) |
| `src/components/journal/ChartGallery.tsx` | Update S3 URL to use cdn.tiltedtrades.com |
| `src/config/environment.ts` | Optionally add `cdn.url` config |

---

## Important Notes

1. **Amplify is Safe**: Custom domains for `api.` and `cdn.` are completely separate from Amplify's `app.` subdomain. Amplify manages its own certificate internally.

2. **Certificate Validation**: DNS validation typically takes 5-30 minutes. The `aws acm wait` command can be used to block until ready.

3. **API Gateway Hosted Zone IDs by Region**:
   - us-east-1: `Z1UJRXOUMOOFQ8`
   - us-west-2: `Z2OJLYMUO9EFXC`
   - eu-west-1: `ZLY8HYME6SFDD`

4. **CloudFront Hosted Zone ID**: Always `Z2FDTNDATAQYW2` (global)

5. **Propagation Time**: DNS changes can take up to 48 hours to propagate globally, but typically work within minutes.
