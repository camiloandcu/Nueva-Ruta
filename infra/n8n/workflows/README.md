# n8n workflows

`wi-004-inbound-ingestion.json` is the reviewable synthetic inbound workflow. It
orchestrates one authenticated FastAPI call and branches on the same safe
execution dimensions stored by the API: technical failure, rejected output,
intentional deterministic processing, and success. It never sends a message.
