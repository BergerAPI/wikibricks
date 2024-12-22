package database

import (
	"context"
	"github.com/jackc/pgx/v5"
	"log"
)

var (
	Instance *pgx.Conn
)

func InitDatabase(connString string) {
	conn, err := pgx.Connect(context.Background(), connString)
	if err != nil {
		log.Fatal(err)
	}

	Instance = conn
}
