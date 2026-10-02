FROM python:3.12.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN pip install --no-cache-dir uv==0.12.0
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY apps/simulator/src ./apps/simulator/src
ENV PYTHONPATH=/app/apps/simulator/src

EXPOSE 8081
CMD ["uvicorn", "nueva_ruta_simulator.main:app", "--host", "0.0.0.0", "--port", "8081"]
