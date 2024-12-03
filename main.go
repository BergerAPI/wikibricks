package main

import (
	"embed"
	"github.com/samber/lo"
	"html/template"
	"log"
	"net/http"
	"os"
	"wikibricks/internal/database"
	"wikibricks/internal/models"
	"wikibricks/internal/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/template/html/v2"
)

//go:embed views/*
var views embed.FS

func main() {
	engine := html.NewFileSystem(http.FS(views), ".go.html")

	// For reading external styling and files
	engine.AddFuncMap(template.FuncMap{
		"read": func(s string) string {
			data, err := views.ReadFile(s)

			if err != nil {
				log.Fatal(err)
			}

			return string(data)
		},
		"unescape": func(s string) template.HTML {
			return template.HTML(s)
		},
		"unescape_css": func(s string) template.CSS {
			return template.CSS(s)
		},
		"elipse": func(size int, s string) string { return lo.Elipse(s, size) },
	})

	app := fiber.New(fiber.Config{
		Views: engine,
	})

	// Connecting to the database
	database.InitDatabase(os.Getenv("DB_CONN"))

	app.Get("/", func(c *fiber.Ctx) error {
		brands, err := models.GetBrands(3, 0)

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		sets, err := models.GetSets(3, 0)

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/index", fiber.Map{
			"Brands": brands,
			"Sets":   sets,
		}, "views/partials/layout")
	})

	routes.InitializeSets(app)
	routes.InitializeBrands(app)

	if err := app.Listen(":3000"); err != nil {
		log.Fatal("Fiber: Failed to start server.")
	}
}
