#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
SWAPPINESS=10
SSH_PORT="${SSH_PORT:-22}"
ORACLE_ASSET_TAG_FILE=/sys/devices/virtual/dmi/id/chassis_asset_tag
SWAP_FILE=/swapfile

say() {
  printf '==> %s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  [ "$(id -u)" -eq 0 ] || fail "run with sudo: sudo bash scripts/deploy/bootstrap-vm.sh"
}

require_ubuntu() {
  . /etc/os-release
  [ "$ID" = "ubuntu" ] || fail "this script supports Ubuntu 22.04 and 24.04 only"
  case "$VERSION_ID" in
    22.04|24.04) ;;
    *) fail "Ubuntu $VERSION_ID is not supported; use 22.04 or 24.04" ;;
  esac
}

install_packages() {
  say "installing base packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg git ufw cron unattended-upgrades apt-listchanges iptables
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    say "docker already installed"
    return
  fi
  say "installing Docker Engine and the compose plugin"
  . /etc/os-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

configure_firewall() {
  say "configuring ufw: ${SSH_PORT}, 80, 443"
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow "${SSH_PORT}/tcp"
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

is_oracle_cloud() {
  [ -r "$ORACLE_ASSET_TAG_FILE" ] && grep -qi oracle "$ORACLE_ASSET_TAG_FILE"
}

open_port_in_iptables() {
  local port="$1"
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
}

configure_oracle_iptables() {
  is_oracle_cloud || return 0
  say "Oracle Cloud detected: opening 80 and 443 in iptables"
  open_port_in_iptables 80
  open_port_in_iptables 443
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
  netfilter-persistent save
}

configure_swap() {
  if [ "$(swapon --show --noheadings | wc -l)" -gt 0 ]; then
    say "swap already present"
    return
  fi
  say "creating ${SWAP_SIZE} swap file"
  fallocate -l "$SWAP_SIZE" "$SWAP_FILE"
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE"
  swapon "$SWAP_FILE"
  grep -q "^${SWAP_FILE} " /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >>/etc/fstab
  echo "vm.swappiness=${SWAPPINESS}" >/etc/sysctl.d/99-careerpilot-swap.conf
  sysctl --system >/dev/null
}

configure_unattended_upgrades() {
  say "enabling unattended security upgrades"
  printf '%s\n' 'APT::Periodic::Update-Package-Lists "1";' 'APT::Periodic::Unattended-Upgrade "1";' >/etc/apt/apt.conf.d/20auto-upgrades
}

first_authorized_keys_file() {
  local candidate
  for candidate in "${SUDO_USER:+/home/$SUDO_USER/.ssh/authorized_keys}" /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys; do
    [ -n "$candidate" ] && [ -s "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

create_deploy_user() {
  say "creating user ${DEPLOY_USER}"
  id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  local home keys
  home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.ssh"
  if keys="$(first_authorized_keys_file)"; then
    install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$keys" "$home/.ssh/authorized_keys"
  else
    say "no SSH key found to copy: add your public key to $home/.ssh/authorized_keys yourself"
  fi
}

harden_ssh() {
  local home
  home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  [ -s "$home/.ssh/authorized_keys" ] || { say "skipping SSH hardening: no key installed for ${DEPLOY_USER}"; return 0; }
  say "disabling SSH password login and root login"
  printf '%s\n' 'PasswordAuthentication no' 'PermitRootLogin no' >/etc/ssh/sshd_config.d/99-careerpilot.conf
  sshd -t
  systemctl reload ssh
}

main() {
  require_root
  require_ubuntu
  install_packages
  install_docker
  configure_firewall
  configure_oracle_iptables
  configure_swap
  configure_unattended_upgrades
  create_deploy_user
  harden_ssh
  say "done. Log in as ${DEPLOY_USER} (ssh ${DEPLOY_USER}@this-server) and continue with the runbook."
}

main "$@"
