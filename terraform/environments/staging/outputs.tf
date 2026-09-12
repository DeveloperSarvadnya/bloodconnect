output "app_server_public_ip" {
  value = module.app_server.public_ip
}

output "instance_id" {
  value = module.app_server.instance_id
}
