package database

import (
	"context"
	"github.com/jackc/pgx/v5"
	"log"
)

var (
	Instance *pgx.Conn
	Context  context.Context
)

func InitDatabase(connString string) {
	Context = context.Background()

	conn, err := pgx.Connect(Context, connString)
	if err != nil {
		log.Fatal(err)
	}

	Instance = conn
}
