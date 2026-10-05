.PHONY: up down seed reset test-db load-test verify quality

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

load-test:
	./scripts/local.sh load-test --events 200 --concurrency 8 --replay-fraction 0.1

verify:
	./scripts/local.sh verify

quality:
	pnpm quality
