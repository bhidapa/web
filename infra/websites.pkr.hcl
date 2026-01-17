packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "ami_name" {
  type    = string
  default = "bhidapa-web-websites"
}

data "amazon-ami" "al2023" {
  filters = {
    name                = "al2023-ami-*-arm64"
    architecture        = "arm64"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["amazon"]
  region      = var.region
}

source "amazon-ebs" "websites" {
  ami_name      = "${var.ami_name}-{{timestamp}}"
  instance_type = "t4g.small"
  region        = var.region
  source_ami    = data.amazon-ami.al2023.id
  ssh_username  = "ec2-user"

  tags = {
    Name    = var.ami_name
    Project = "bhidapa-web"
    OS      = "Amazon Linux 2023"
    Arch    = "ARM64"
  }

  launch_block_device_mappings {
    device_name = "/dev/xvda"
    volume_size = 30
    volume_type = "gp3"
    delete_on_termination = true
  }
}

build {
  sources = ["source.amazon-ebs.websites"]

  provisioner "shell" {
    inline = [
      "sudo dnf update -y",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo dnf install -y docker",
      "sudo systemctl enable docker",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 -o /usr/libexec/docker/cli-plugins/docker-compose",
      "sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo usermod -a -G docker ec2-user",
    ]
  }

  provisioner "shell" {
    inline = [
      "docker --version",
      "docker compose --version",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo dnf clean all",
      "sudo rm -rf /tmp/*",
      "sudo rm -rf /var/tmp/*",
    ]
  }
}
