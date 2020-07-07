#!/bin/bash
set -eu

[[ -z "${CLOUDRON_LDAP_SERVER:-}" ]] && echo "Cloudron LDAP is not enabled"

if [[ $# -ne 1 ]]; then
    echo "usage: enable-ldap.sh <root-token>"
    exit 1
fi

# the vault login stashes the raw root token in $HOME/.vault-token
rm -rf /tmp/vault/home && mkdir -p /tmp/vault/home
export HOME=/tmp/vault/home

root_token=$1
echo $root_token | vault login -

# must disable ldap to overwrite the config
vault auth disable ldap
vault auth enable ldap
vault write auth/ldap/config \
  url="${CLOUDRON_LDAP_URL}" \
  userdn="${CLOUDRON_LDAP_USERS_BASE_DN}" \
  userattr=username \
  discoverdn=true \
  binddn="${CLOUDRON_LDAP_BIND_DN}" \
  bindpass="${CLOUDRON_LDAP_BIND_PASSWORD}"

echo "LDAP login enabled"
