build:
	npx tailwindcss -i ./global.css -o ./views/style/tailwind.css
	go build -o ./tmp/main.exe .