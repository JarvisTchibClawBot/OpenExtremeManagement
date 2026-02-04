# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o mock-switch .

# Final stage
FROM alpine:3.19

WORKDIR /app

RUN apk --no-cache add ca-certificates

COPY --from=builder /app/mock-switch .

EXPOSE 9443

CMD ["./mock-switch"]
