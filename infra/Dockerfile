FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY infra/proxy.mjs ./proxy.mjs
COPY infra/http-gateway.mjs ./http-gateway.mjs
USER node
EXPOSE 3000
CMD ["node", "proxy.mjs"]
