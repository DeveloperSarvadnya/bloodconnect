variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "instance_type" {
  type    = string
  default = "t2.micro"
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI for ap-south-1"
  type        = string
  default     = "ami-0fa52f1a01deb1658"
}

variable "key_pair_name" {
  type    = string
  default = "bloodconnect-dev-key"
}

variable "ssh_allowed_cidr" {
  type    = string
  default = "0.0.0.0/0"
}
