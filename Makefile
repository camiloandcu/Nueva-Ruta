.PHONY: up down reset verify quality

up:
	./scripts/local.sh start

down:
	./scripts/local.sh stop

reset:
	./scripts/local.sh reset

verify:
	./scripts/local.sh verify

quality:
	pnpm quality

