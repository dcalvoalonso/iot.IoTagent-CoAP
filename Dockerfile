FROM node:8

COPY . /opt/iotacoap
WORKDIR /opt/iotacoap
RUN npm install

ENTRYPOINT bin/iotagent-coap config.js

EXPOSE 5683