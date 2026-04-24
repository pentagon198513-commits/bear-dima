#!/usr/bin/env bash
# MTProto proxy installer for Linux VPS (systemd).
# Uses mtg (https://github.com/9seconds/mtg) — Go implementation with Fake TLS.
# Traffic is indistinguishable from HTTPS to the masking domain, so RKN DPI
# cannot block it by signature.
#
# Usage (as root or with sudo):
#     sudo MASK_DOMAIN=www.cloudflare.com PROXY_PORT=443 bash mtproto-install.sh
#
# Env vars (optional):
#     MASK_DOMAIN   domain to impersonate via SNI (default www.cloudflare.com)
#     PROXY_PORT    TCP port to listen on     (default 443 — looks most like HTTPS)
#     MTG_VERSION   mtg release tag           (default 2.1.7)
#     INSTALL_DIR   where to place binary     (default /opt/mtg)
#
# Requires: curl, tar, systemd. Works on amd64 / arm64.

set -euo pipefail

MASK_DOMAIN="${MASK_DOMAIN:-www.cloudflare.com}"
PROXY_PORT="${PROXY_PORT:-443}"
MTG_VERSION="${MTG_VERSION:-2.1.7}"
INSTALL_DIR="${INSTALL_DIR:-/opt/mtg}"

SUDO=""
if [[ $EUID -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo "ERROR: run as root or install sudo" >&2
        exit 1
    fi
fi

for cmd in curl tar systemctl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: required tool missing: $cmd" >&2
        exit 1
    fi
done

arch=$(uname -m)
case "$arch" in
    x86_64|amd64)   mtg_arch="amd64" ;;
    aarch64|arm64)  mtg_arch="arm64" ;;
    armv7l)         mtg_arch="arm" ;;
    *) echo "ERROR: unsupported arch: $arch" >&2; exit 1 ;;
esac

asset="mtg-${MTG_VERSION}-linux-${mtg_arch}"
url="https://github.com/9seconds/mtg/releases/download/v${MTG_VERSION}/${asset}.tar.gz"

echo "==> downloading $url"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 -o "$tmp/mtg.tar.gz" "$url"
tar -C "$tmp" -xzf "$tmp/mtg.tar.gz"

bin_path=$(find "$tmp" -type f -name mtg -perm -u+x | head -n1)
if [[ -z "$bin_path" ]]; then
    echo "ERROR: mtg binary not found in archive" >&2
    exit 1
fi

echo "==> installing to $INSTALL_DIR/mtg"
$SUDO mkdir -p "$INSTALL_DIR"
$SUDO install -m 0755 "$bin_path" "$INSTALL_DIR/mtg"

echo "==> generating Fake TLS secret for $MASK_DOMAIN"
SECRET=$("$INSTALL_DIR/mtg" generate-secret --hex "$MASK_DOMAIN")
if [[ -z "$SECRET" || ! "$SECRET" =~ ^ee ]]; then
    echo "ERROR: could not generate valid secret (got: $SECRET)" >&2
    exit 1
fi

echo "==> installing systemd unit /etc/systemd/system/mtg.service"
$SUDO tee /etc/systemd/system/mtg.service >/dev/null <<UNIT
[Unit]
Description=MTProto proxy (mtg) with Fake TLS
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/mtg simple-run 0.0.0.0:${PROXY_PORT} ${SECRET}
Restart=on-failure
RestartSec=3
DynamicUser=yes
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now mtg.service

sleep 1
if ! $SUDO systemctl is-active --quiet mtg.service; then
    echo "ERROR: mtg.service failed to start. Logs:" >&2
    $SUDO journalctl -u mtg.service --no-pager -n 40 >&2 || true
    exit 1
fi

PUBIP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || echo "<YOUR-SERVER-IP>")

cat <<INFO

============================================================
MTProto proxy is RUNNING
    host:     ${PUBIP}
    port:     ${PROXY_PORT}
    fake SNI: ${MASK_DOMAIN}
    secret:   ${SECRET}

Open on device with Telegram:
    tg://proxy?server=${PUBIP}&port=${PROXY_PORT}&secret=${SECRET}

Or share link:
    https://t.me/proxy?server=${PUBIP}&port=${PROXY_PORT}&secret=${SECRET}

Useful commands:
    systemctl status mtg
    journalctl -u mtg -f
    systemctl restart mtg

Firewall: open TCP ${PROXY_PORT}. If ufw:
    ufw allow ${PROXY_PORT}/tcp
============================================================
INFO
