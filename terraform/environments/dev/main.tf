# ============================================================
# DEV environment — BloodConnect infrastructure
# ============================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — each environment gets its own state file/key.
  # Bucket and DynamoDB lock table are created once, manually or via a
  # separate bootstrap stack, before running this.
  backend "s3" {
    bucket         = "bloodconnect-tfstate"
    key            = "dev/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "bloodconnect-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

module "app_server" {
  source = "../../modules/ec2"

  project_name     = "bloodconnect"
  environment      = "dev"
  instance_type    = var.instance_type
  ami_id           = var.ami_id
  key_pair_name    = var.key_pair_name
  ssh_allowed_cidr = var.ssh_allowed_cidr
}
