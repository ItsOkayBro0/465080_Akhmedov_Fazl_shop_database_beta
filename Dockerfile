FROM oven/bun:1.4.2

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --chown=bun:bun . .

USER bun

ENV NODE_ENV=production

EXPOSE 3000/tcp

CMD ["bun", "run", "start"]
