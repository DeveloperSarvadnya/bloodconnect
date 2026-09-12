output "public_ip" {
  description = "Elastic IP address of the app server (used by Ansible inventory)"
  value       = aws_eip.app_eip.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app_server.id
}

output "security_group_id" {
  value = aws_security_group.app_sg.id
}
