
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js index.html ./
COPY custom-cap-dashboard ./custom-cap-dashboard

EXPOSE 8080

CMD ["npm", "start"]
