FROM cloudron/base:2.0.0@sha256:f9fea80513aa7c92fe2e7bf3978b54c8ac5222f47a9a32a7f8833edf0eb5a4f4

RUN apt-get update && \
    apt-get install -y libcap2-bin && \
    rm -rf /var/cache/apt /var/lib/apt/lists

WORKDIR /app/code

# setting config path
ENV \
    CONFIG_PATH="/app/data/" \
    HOME="/app/data/" \
    PATH=/app/code:$PATH \
    VAULT_ADDR="http://127.0.0.1:8200" \
    VAULT_API_ADDR="http://127.0.0.1:8200" \
    VAULT="/app/code/vault"

# use wget to the latest binary compile for Linux
ENV VAULT_VERSION=1.4.3
RUN mkdir -p /app/pkg /app/code && \
    chown -R cloudron:cloudron /app/code /app/pkg
RUN wget https://releases.hashicorp.com/vault/1.4.2/vault_${VAULT_VERSION}_linux_amd64.zip  && \
    unzip vault_${VAULT_VERSION}_linux_amd64.zip -d /app/code && \
    rm -f /app/code/vault_${VAULT_VERSION}_linux_amd64.zip

# set file caps so the executable can run mlock as non privileged user (https://github.com/hashicorp/vault/issues/122)
RUN setcap cap_ipc_lock=+ep /app/code/vault

COPY start.sh ldap-config.sh /app/pkg/

# set the container to connect into the data folder as a nice user friendly thing
WORKDIR /app/data

# kicking off the start script
CMD [ "/app/pkg/start.sh" ]

