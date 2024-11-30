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

// GetSets returns all sets joined with the brand they originate from
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

// GetSetById returns one set by its id joined with the brand they originate from
func GetSetById(id int32) (Set, error) {
	rows, err := database.Instance.Query(database.Context, "SELECT t_set.*, tb.name as brand_name from t_set join public.t_brand tb on tb.id = t_set.brand_id where t_set.id = $1;", id)
	defer rows.Close()

	if err != nil {
		return Set{}, errors.New("failed to run query")
	}

	set, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[Set])

	if err != nil {
		return Set{}, errors.New("failed to collect rows")
	}

	return set, nil
}
