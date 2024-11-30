package models

import (
	"errors"
	"github.com/jackc/pgx/v5"
	"wikibricks/internal/database"
)

type Set struct {
	Id          int32  `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	Pieces      int32  `json:"pieces" db:"pieces"`
	BrandId     int32  `json:"brand_id" db:"brand_id"`
	BrandName   string `json:"brand_name" db:"brand_name"`
}

func GetSets() ([]Set, error) {
	rows, err := database.Instance.Query(database.Context, "SELECT t_set.*, tb.name as brand_name from t_set join public.t_brand tb on tb.id = t_set.brand_id;")
	defer rows.Close()

	if err != nil {
		return nil, errors.New("failed to run query")
	}

	sets, err := pgx.CollectRows(rows, pgx.RowToStructByName[Set])

	if err != nil {
		return nil, errors.New("failed to collect rows")
	}

	return sets, nil
}
