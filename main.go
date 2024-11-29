package main

import (
	"context"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"log"
)

func main() {
	app := fiber.New()

	// Connecting to the database
	conn, err := pgx.Connect(context.Background(), "postgres://postgres:password@localhost:5432")
	if err != nil {
		log.Fatal("Unable to connect to database")
	}

	// CLosing the connection when the application is shut down
	defer func(conn *pgx.Conn, ctx context.Context) {
		if err := conn.Close(ctx); err != nil {
			log.Fatal("Failed to close connection.")
		}
	}(conn, context.Background())

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello, World!")
	})

	if err := app.Listen(":3000"); err != nil {
		log.Fatal("Fiber: Failed to start server.")
	}
}
