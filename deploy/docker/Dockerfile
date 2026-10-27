FROM node:22-alpine

WORKDIR /opt/free-my-vizio
COPY src ./src
COPY web ./web
COPY package.json ./

ENV NODE_ENV=production
ENV FMV_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8730
ENTRYPOINT ["node", "src/main.ts"]
