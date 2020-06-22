FROM node:14-alpine AS base
RUN apk add --update bash && rm -rf /var/cache/apk/*
RUN mkdir -p /var/app && chown -R node /var/app
WORKDIR /var/app
COPY . .
RUN npm ci --only=prod --silent
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD curl --fail http://0.0.0.0:3000 || exit 1
CMD npm run start
