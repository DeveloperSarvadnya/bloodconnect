#!/usr/bin/env bash
# ============================================================
# One-time setup: creates the S3 bucket + DynamoDB table used
# by every environment's Terraform "backend" block for remote
# state storage and locking. Run this manually once per AWS
# account before the first `terraform init` in any environment.
# ============================================================
set -euo pipefail

REGION="ap-south-1"
BUCKET="bloodconnect-tfstate"
LOCK_TABLE="bloodconnect-tf-locks"

echo "Creating S3 bucket for Terraform state: $BUCKET"
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "Creating DynamoDB table for state locking: $LOCK_TABLE"
aws dynamodb create-table \
  --table-name "$LOCK_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo "Done. You can now run 'terraform init' inside any terraform/environments/<env> directory."
