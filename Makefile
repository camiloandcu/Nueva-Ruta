.PHONY: up down seed reset verify quality

up:
	./scripts/local.sh start

down:
	./scripts/local.sh stop

reset:
	./scripts/local.sh reset

seed:
	./scripts/local.sh seed

verify:
	./scripts/local.sh verify

quality:
	pnpm quality
