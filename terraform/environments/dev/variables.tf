variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "instance_type" {
  type = string
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI for ap-south-1 — verify current ID in AWS console before applying"
  type        = string
}

variable "key_pair_name" {
  type = string
}

variable "ssh_allowed_cidr" {
  type    = string
  default = "0.0.0.0/0"
}
