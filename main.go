package main

import (
	"embed"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/template/html/v2"
	"html/template"
	"log"
	"net/http"
	"wikibricks/internal/database"
	"wikibricks/internal/models"
)

//go:embed views/*
var views embed.FS

func main() {
	engine := html.NewFileSystem(http.FS(views), ".gohtml")

	// For reading external styling and files
	engine.AddFuncMap(template.FuncMap{
		"read": func(s string) string {
			bytes, err := views.ReadFile(s)

			if err != nil {
				log.Fatal(err)
			}

			return string(bytes)
		},
		"unescape": func(s string) template.HTML {
			return template.HTML(s)
		},
		"unescape_css": func(s string) template.CSS {
			return template.CSS(s)
		},
	})

	app := fiber.New(fiber.Config{
		Views: engine,
	})

	// Connecting to the database
	database.InitDatabase("postgres://postgres:password@localhost:5432")

	app.Get("/brands", func(c *fiber.Ctx) error {
		brands, err := models.GetBrands()

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/brands", fiber.Map{
			"Brands": brands,
			"Title":  "Brand Overview | Wikibricks",
		}, "views/partials/layout")
	})

	app.Get("/sets", func(c *fiber.Ctx) error {
		sets, err := models.GetSets()

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/sets", fiber.Map{
			"Sets":  sets,
			"Title": "Sets Overview | Wikibricks",
		}, "views/partials/layout")
	})

	if err := app.Listen(":3000"); err != nil {
		log.Fatal("Fiber: Failed to start server.")
	}
}
