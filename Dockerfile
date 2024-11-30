# Stage 1: Node Builder
FROM node:lts-alpine AS node-builder

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install
COPY . .

RUN npm run build

# Stage 2: Go Builder
FROM golang:alpine3.20 AS go-builder
WORKDIR /app
COPY . .
COPY --from=node-builder /app/views ./views
RUN go build -o server main.go

# Stage 3: Runner
FROM scratch
WORKDIR /app
COPY --from=go-builder /app/server .
EXPOSE 3000
CMD ["./server"]
