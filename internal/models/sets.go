package models

import (
	"errors"
	"wikibricks/internal/database"

	"github.com/jackc/pgx/v5"
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
func GetSets(limit, offset int) ([]Set, error) {
	rows, err := database.Instance.Query(database.Context, "select t_set.*, tb.name as brand_name from t_set join public.t_brand tb on tb.id = t_set.brand_id limit $1 offset $2;", limit, offset)
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
	rows, err := database.Instance.Query(database.Context, "select t_set.*, tb.name as brand_name from t_set join public.t_brand tb on tb.id = t_set.brand_id where t_set.id = $1;", id)
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

// InsertSet creates a new set entry in the database
func InsertSet(set Set) error {
	_, err := database.Instance.Exec(database.Context, "insert into t_set (name, description, pieces, brand_id) values ($1, $2, $3, $4)", set.Name, set.Description, set.Pieces, set.BrandId)
	if err != nil {
		return errors.New("unable to insert into database")
	}

	return nil
}
