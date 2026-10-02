.PHONY: up down seed reset test-db verify quality

up:
	./scripts/local.sh start

down:
	./scripts/local.sh stop

reset:
	./scripts/local.sh reset

seed:
	./scripts/local.sh seed

test-db:
	./scripts/local.sh test-db

verify:
	./scripts/local.sh verify

quality:
	pnpm quality
