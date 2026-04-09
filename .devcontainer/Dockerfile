# Fedora-based development container for cx-cli
# Provides Bun, Git, and build tools in a minimal Fedora image.
ARG BASEIMAGE=registry.fedoraproject.org/fedora:latest
FROM ${BASEIMAGE}

RUN dnf -y update \
  && dnf -y install curl fish git-core unzip make gcc gcc-c++ ruby jq htop which procps-ng tar \
  && dnf clean all

# Install Bun globally for all users.
RUN export BUN_INSTALL=/usr/local/bun \
  && curl -fsSL https://bun.sh/install | bash

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /usr/local/bun-node-fallback-bin \
  && ln -s /usr/local/bin/bun /usr/local/bun-node-fallback-bin/node \
  && groupadd bun --gid 1000 \
  && useradd bun --uid 1000 --gid bun --shell /usr/bin/fish --create-home \
  && ln -s /usr/local/bin/bun /usr/local/bin/bunx \
  && which bun \
  && which bunx \
  && bun --version \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PATH=/usr/local/bun/bin:/usr/local/bun-node-fallback-bin:${PATH}
ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
ARG BUN_INSTALL_BIN=/usr/local/bin
ENV BUN_INSTALL_BIN=${BUN_INSTALL_BIN}

WORKDIR /home/bun/app
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["fish"]
