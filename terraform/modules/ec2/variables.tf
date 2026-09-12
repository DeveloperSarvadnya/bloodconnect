variable "project_name" {
  description = "Project name used in resource tags/names"
  type        = string
  default     = "bloodconnect"
}

variable "environment" {
  description = "Deployment environment: dev, staging, or prod"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type — t2.micro / t3.micro is AWS Free Tier eligible"
  type        = string
  default     = "t2.micro"
}

variable "ami_id" {
  description = "AMI ID — Ubuntu 22.04 LTS (region-specific, override per environment)"
  type        = string
}

variable "key_pair_name" {
  description = "Name of an existing AWS EC2 key pair for SSH access"
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "CIDR range allowed to SSH into the instance (lock this down to your IP in real use)"
  type        = string
  default     = "0.0.0.0/0"
}
