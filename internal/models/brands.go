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
