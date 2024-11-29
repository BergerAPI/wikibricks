package main

import (
	"context"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"log"
)

type Brand struct {
	Id          int32  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

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

	app.Get("/brands", func(c *fiber.Ctx) error {
		rows, err := conn.Query(context.Background(), "SELECT * from t_brand;")
		defer rows.Close()

		if err != nil {
			log.Fatal(err)
		}

		brands, err := pgx.CollectRows(rows, pgx.RowToStructByName[Brand])

		if err != nil {
			log.Fatal(err)
		}

		return c.JSON(brands)
	})

	if err := app.Listen(":3000"); err != nil {
		log.Fatal("Fiber: Failed to start server.")
	}
}
