from fastapi import FastAPI

app = FastAPI(title="Nueva Ruta Simulator", version="0.1.0")


@app.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"service": "simulator", "status": "alive"}


@app.get("/health/ready")
async def readiness() -> dict[str, str]:
    return {"service": "simulator", "status": "ready"}
