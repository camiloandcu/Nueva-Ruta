FROM python:3.12.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN pip install --no-cache-dir uv==0.12.0
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY apps/api/src ./apps/api/src
ENV PYTHONPATH=/app/apps/api/src

EXPOSE 8000
CMD ["uvicorn", "nueva_ruta_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
