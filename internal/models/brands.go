package models

import (
	"errors"
	"github.com/jackc/pgx/v5"
	"wikibricks/internal/database"
)

type Brand struct {
	Id          int32  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func GetBrands() ([]Brand, error) {
	rows, err := database.Instance.Query(database.Context, "SELECT * from t_brand;")
	defer rows.Close()

	if err != nil {
		return nil, errors.New("failed to run query")
	}

	brands, err := pgx.CollectRows(rows, pgx.RowToStructByName[Brand])

	if err != nil {
		return nil, errors.New("failed to collect rows")
	}

	return brands, nil
}

// GetBrandById returns one brand by its id
func GetBrandById(id int32) (Brand, error) {
	rows, err := database.Instance.Query(database.Context, "SELECT * from t_brand where id = $1;", id)
	defer rows.Close()

	if err != nil {
		return Brand{}, errors.New("failed to run query")
	}

	brand, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[Brand])

	if err != nil {
		return Brand{}, errors.New("failed to collect rows")
	}

	return brand, nil
}
