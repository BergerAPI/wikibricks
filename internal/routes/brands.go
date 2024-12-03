package routes

import (
	"fmt"
	"github.com/gofiber/fiber/v2"
	"strconv"
	"wikibricks/internal/models"
)

func InitializeBrands(app *fiber.App) {
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
}
