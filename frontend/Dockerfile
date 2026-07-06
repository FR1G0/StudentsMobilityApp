FROM node:20-trixie-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

EXPOSE 4200

CMD ["sh","-c","npx http-server dist/frontend/browser -p 4200 -c-1"]
