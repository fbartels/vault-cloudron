#!/bin/bash
set -eu

if [[ ! -e "/app/data/config.hcl" ]]; then
	cat <<-EOF > "/app/data/config.hcl"
disable_mlock = false

ui = true
storage "file" {
  path = "/app/data/vault-store/"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}
EOF
fi

mkdir -p /app/data/vault-store
chown -R cloudron:cloudron /app/data

echo "==> Starting vault"
exec gosu cloudron:cloudron /app/code/vault server -config=/app/data/config.hcl
