package main

import (
	"github.com/gofiber/fiber/v2"
	"log"
	"wikibricks/database"
	"wikibricks/models"
)

func main() {
	app := fiber.New()

	// Connecting to the database
	database.InitDatabase("postgres://postgres:password@localhost:5432")

	app.Get("/brands", func(c *fiber.Ctx) error {
		brands, err := models.GetBrands()

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.JSON(brands)
	})

	if err := app.Listen(":3000"); err != nil {
		log.Fatal("Fiber: Failed to start server.")
	}
}
