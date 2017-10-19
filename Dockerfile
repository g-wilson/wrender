FROM node:8.6.0-alpine
MAINTAINER George Wilson <george@g-wilson.co.uk>

# Install required build tools
RUN apk update && apk upgrade
RUN apk add --no-cache make gcc g++ python git openssh
RUN apk add vips-dev fftw-dev --update-cache --repository https://dl-3.alpinelinux.org/alpine/edge/testing/

# Create application directory
RUN mkdir -p /app
WORKDIR /app

# Install packages
COPY package.json /app/
RUN npm install

# Copy application source code
COPY . .

# Expose ports
EXPOSE 80

CMD [ "npm", "start" ]
