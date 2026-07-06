FROM node:20-trixie-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

CMD ["npm","run","start:dev"]
