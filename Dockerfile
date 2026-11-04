FROM haskell:9.10.3-bookworm AS build
WORKDIR /src
COPY engine/engine-harness.cabal engine/stack.yaml engine/stack.yaml.lock engine/LICENSE ./
RUN stack --system-ghc --no-install-ghc build --only-dependencies -j2
COPY engine/src ./src
COPY engine/dbd ./dbd
RUN stack --system-ghc --no-install-ghc build :dbd-playground --copy-bins --local-bin-path /out -j2 \
    && /out/dbd-playground --self-test

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgmp10 libnuma1 libtinfo6 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/dbd-playground /usr/local/bin/naruto-engine
COPY --chown=node:node *.js *.css *.html *.json server.cjs rooms.cjs ./
COPY --chown=node:node assets ./assets
COPY --chown=node:node classic/catalog.json classic/implemented.json ./classic/
COPY --chown=node:node outputs/rank-layout.json ./outputs/
COPY --chown=node:node engine/src/Game/Characters ./engine/src/Game/Characters
ENV ARENA_ENGINE=/usr/local/bin/naruto-engine ARENA_HOSTED=1 NODE_ENV=production PORT=10000
USER node
EXPOSE 10000
CMD ["node","server.cjs"]
