FROM node:8
MAINTAINER George Wilson <george@g-wilson.co.uk>

# Fetch dumb-init
ADD https://github.com/Yelp/dumb-init/releases/download/v1.1.1/dumb-init_1.1.1_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]

RUN mkdir -p /var/app && chown node:node /var/app
WORKDIR /var/app

COPY package*.json ./
RUN npm install --production

ARG NODE_ENV
ENV NODE_ENV ${NODE_ENV:-development}
RUN if [ "$NODE_ENV" != "production" ]; then npm install --only=dev; fi

EXPOSE 3010

COPY . .

USER node
CMD [ "node", "server" ]
