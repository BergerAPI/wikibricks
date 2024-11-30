package main

import (
	"embed"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"wikibricks/internal/database"
	"wikibricks/internal/models"

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

	app.Get("/brands", func(c *fiber.Ctx) error {
		page, err := strconv.Atoi(c.Query("page", "0"))

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		brands, err := models.GetBrands(100, page*100)

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/brands", fiber.Map{
			"Brands":   brands,
			"Title":    "Brand Overview | Wikibricks",
			"NextPage": page,
		}, "views/partials/layout")
	})

	app.Get("/sets", func(c *fiber.Ctx) error {
		page, err := strconv.Atoi(c.Query("page", "0"))

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		sets, err := models.GetSets(100, page*100)

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/sets", fiber.Map{
			"Sets":     sets,
			"Title":    "Sets Overview | Wikibricks",
			"NextPage": page,
		}, "views/partials/layout")
	})

	app.Get("/sets/add", func(c *fiber.Ctx) error {
		brands, err := models.GetBrands(10000, 0)

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/add_set", fiber.Map{
			"Title":  "Add a new set | Wikibricks",
			"Brands": brands,
			"Error":  c.Query("error", ""),
			"Info":   c.Query("info", ""),
		}, "views/partials/layout")
	})

	app.Post("/sets/add", func(c *fiber.Ctx) error {
		payload := struct {
			Name        string `form:"name"`
			Description string `form:"description"`
			Pieces      int32  `form:"pieces"`
			Brand       int32  `form:"brand"`
		}{}

		if err := c.BodyParser(&payload); err != nil {
			return err
		}

		err := models.InsertSet(models.Set{
			Name:        payload.Name,
			Description: payload.Description,
			Pieces:      payload.Pieces,
			BrandId:     payload.Brand,
		})

		if err != nil {
			return c.Redirect("/sets/add?error=" + url.QueryEscape(err.Error()))
		}

		return c.Redirect("/sets/add?info=" + url.QueryEscape("Entry has been created. Waiting for approval by an administrator."))
	})

	app.Get("/sets/:id", func(c *fiber.Ctx) error {
		id, err := strconv.Atoi(c.Params("id"))

		if err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}

		set, err := models.GetSetById(int32(id))

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/single_set", fiber.Map{
			"Set":   set,
			"Title": fmt.Sprintf("%s at Wikibricks", set.Name),
		}, "views/partials/layout")
	})

	app.Get("/brands/:id", func(c *fiber.Ctx) error {
		id, err := strconv.Atoi(c.Params("id"))

		if err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}

		brand, err := models.GetBrandById(int32(id))

		if err != nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}

		return c.Render("views/single_brand", fiber.Map{
			"Brand": brand,
			"Title": fmt.Sprintf("%s at Wikibricks", brand.Name),
		}, "views/partials/layout")
	})

	if err := app.Listen(":3000"); err != nil {
		log.Fatal("Fiber: Failed to start server.")
	}
}
