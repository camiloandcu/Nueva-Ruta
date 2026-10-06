#!/usr/bin/env python3
"""Run a bounded, synthetic-only inbound API load check against a local stack."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[1]


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        row = line.strip()
        if not row or row.startswith("#") or "=" not in row:
            continue
        key, value = row.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def percentile(samples: list[float], quantile: float) -> float:
    ordered = sorted(samples)
    if not ordered:
        return 0.0
    index = max(0, min(len(ordered) - 1, int((len(ordered) * quantile) + 0.999999) - 1))
    return round(ordered[index], 2)


async def run(count: int, concurrency: int, replay_fraction: float) -> int:
    env = {**read_env(ROOT / ".env"), **read_env(ROOT / ".env.runtime"), **os.environ}
    if env.get("LOAD_TEST_AI_PROVIDER", "").lower() != "deterministic":
        print(
            "error: use the isolated deterministic load-test API; no request was sent",
            file=sys.stderr,
        )
        return 2
    base_url = env.get("LOAD_TEST_API_URL", "http://127.0.0.1:8000").rstrip("/")
    supabase_url = env.get("LOAD_TEST_SUPABASE_URL", "http://127.0.0.1:54321").rstrip("/")
    anon_key = env.get("SUPABASE_ANON_KEY", "")
    email = env.get("DEMO_OPERATOR_EMAIL", "")
    password = env.get("DEMO_OPERATOR_PASSWORD", "")
    if not all((anon_key, email, password)):
        print(
            "error: local Supabase key and operator credentials are required in ignored .env files",
            file=sys.stderr,
        )
        return 2

    timeout = httpx.Timeout(30.0)
    limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=concurrency)
    async with httpx.AsyncClient(timeout=timeout, limits=limits) as auth_client:
        auth_response = await auth_client.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon_key},
            json={"email": email, "password": password},
        )
        if not auth_response.is_success:
            print(
                f"error: local operator sign-in failed (HTTP {auth_response.status_code})",
                file=sys.stderr,
            )
            return 2
        token = auth_response.json().get("access_token")
    if not token:
        print("error: local sign-in did not return an access token", file=sys.stderr)
        return 2

    run_id = uuid4().hex[:12]
    start_at = datetime(2026, 9, 15, 17, tzinfo=UTC)
    events: list[dict[str, object]] = []
    for index in range(count):
        source_event_id = f"wi009-{run_id}-{index:04d}"
        events.append(
            {
                "source_event_id": source_event_id,
                "inbound_at": (start_at + timedelta(seconds=index)).isoformat(),
                "channel": "ctwa",
                "source_detail": "WI-009 deterministic synthetic load fixture",
                "creator_business_id": "CR-001",
                "message": "Hola, quiero conocer opciones generales para deuda de tarjeta en TX.",
                "fictional_phone": "+15550100",
                "consent": {
                    "status": "granted",
                    "source": "wi009-load-test",
                    "conversation_window_open": True,
                },
                "synthetic": True,
                "correlation_id": f"wi009-{run_id}-{index:04d}",
            }
        )

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    semaphore = asyncio.Semaphore(concurrency)
    latencies: list[float] = []
    result_ids: set[tuple[str, str]] = set()
    initial_errors = 0
    replay_errors = 0
    replay_bodies: dict[str, dict[str, object]] = {}
    run_started_at = datetime.now(UTC).isoformat()
    load_started = time.perf_counter()

    async def post_event(
        client: httpx.AsyncClient, event: dict[str, object], *, replay: bool = False
    ) -> None:
        nonlocal initial_errors, replay_errors
        async with semaphore:
            started = time.perf_counter()
            try:
                response = await client.post(
                    f"{base_url}/v1/ingestion/events", headers=headers, json=event
                )
                latencies.append((time.perf_counter() - started) * 1000)
                if response.status_code not in {200, 201}:
                    if replay:
                        replay_errors += 1
                    else:
                        initial_errors += 1
                    return
                result = response.json()
                source_event_id = str(event["source_event_id"])
                if replay:
                    replay_bodies[source_event_id] = result
                result_ids.add(("ctwa", source_event_id))
            except httpx.HTTPError:
                latencies.append((time.perf_counter() - started) * 1000)
                if replay:
                    replay_errors += 1
                else:
                    initial_errors += 1

    async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
        await asyncio.gather(*(post_event(client, event) for event in events))
        originals_finished = time.perf_counter()
        replay_count = min(count, max(1, int(count * replay_fraction)))
        replays = events[:replay_count]
        await asyncio.gather(*(post_event(client, event, replay=True) for event in replays))

        drain_started = time.perf_counter()
        pending = set(result_ids)
        while pending and time.perf_counter() - drain_started < 60:
            async def result_exists(item: tuple[str, str]) -> tuple[tuple[str, str], bool]:
                channel, source_event_id = item
                try:
                    response = await client.get(
                        f"{base_url}/v1/ingestion/results/{channel}/{source_event_id}",
                        headers=headers,
                    )
                    return item, response.is_success
                except httpx.HTTPError:
                    return item, False

            statuses = await asyncio.gather(*(result_exists(item) for item in pending))
            pending = {item for item, exists in statuses if not exists}
            if pending:
                await asyncio.sleep(0.2)

    run_finished_at = datetime.now(UTC).isoformat()
    elapsed_seconds = max(time.perf_counter() - load_started, 0.000001)
    completed = len(result_ids)
    replayed = sum(bool(value.get("replayed")) for value in replay_bodies.values())
    initial_seconds = max(originals_finished - load_started, 0.000001)
    output = {
        "run_id": run_id,
        "started_at_utc": run_started_at,
        "finished_at_utc": run_finished_at,
        "conditions": {
            "synthetic_events": count,
            "concurrency": concurrency,
            "replay_fraction": replay_fraction,
            "ai_provider": "deterministic",
            "target": "local API and Supabase; no live AI or external consumer data",
        },
        "results": {
            "unique_events_queryable": completed,
            "initial_request_errors": initial_errors,
            "replay_request_errors": replay_errors,
            "losses": max(0, count - completed),
            "replay_requests": replay_count,
            "replay_responses_marked_replayed": replayed,
            "duplicate_effects": (
                0 if len(replay_bodies) == replay_count and replayed == replay_count else None
            ),
            "initial_events_per_second": round(completed / initial_seconds, 2),
            "total_requests_per_second": round((count + replay_count) / elapsed_seconds, 2),
            "initial_ingest_seconds": round(initial_seconds, 3),
            "async_backlog_drain": "not_applicable_synchronous_ingestion",
            "result_visibility_drain_seconds": round(time.perf_counter() - drain_started, 3),
            "request_latency_ms_p50": percentile(latencies, 0.50),
            "request_latency_ms_p95": percentile(latencies, 0.95),
            "latency_samples": len(latencies),
            "unresolved_results_after_60s": len(pending),
        },
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    successful = completed == count and not initial_errors and not replay_errors and not pending
    return 0 if successful else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events", type=int, default=200)
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--replay-fraction", type=float, default=0.1)
    args = parser.parse_args()
    if args.events < 200 or args.concurrency < 1 or not 0 < args.replay_fraction <= 0.5:
        parser.error("events must be >=200, concurrency >=1, and replay fraction within (0, 0.5]")
    return asyncio.run(run(args.events, args.concurrency, args.replay_fraction))


if __name__ == "__main__":
    raise SystemExit(main())
