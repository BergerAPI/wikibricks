package routes

import (
	"bytes"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"github.com/yuin/goldmark"
	"net/url"
	"strconv"
	"wikibricks/internal/models"
)

func InitializeSets(app *fiber.App) {
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

	app.Get("/sets/:id<int>", func(c *fiber.Ctx) error {
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
			return c.Redirect("/sets/add?error=" + url.QueryEscape(err.Error()))
		}

		// Converting the description from Markdown to HTML
		var buf bytes.Buffer
		if err := goldmark.Convert([]byte(payload.Description), &buf); err != nil {
			return c.Redirect("/sets/add?error=" + url.QueryEscape(err.Error()))
		}

		err := models.InsertSet(models.Set{
			Name:        payload.Name,
			Description: buf.String(),
			Pieces:      payload.Pieces,
			BrandId:     payload.Brand,
		})

		if err != nil {
			return c.Redirect("/sets/add?error=" + url.QueryEscape(err.Error()))
		}

		return c.Redirect("/sets/add?info=" + url.QueryEscape("Entry has been created. Waiting for approval by an administrator."))
	})
}
