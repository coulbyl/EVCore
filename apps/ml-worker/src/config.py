import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    database_url: str
    pgbouncer_url: str
    redis_host: str
    redis_port: int
    log_level: str


def load() -> Config:
    return Config(
        database_url=_require("DATABASE_URL"),
        pgbouncer_url=os.environ.get("PGBOUNCER_URL") or _require("DATABASE_URL"),
        redis_host=os.environ.get("REDIS_HOST", "localhost"),
        redis_port=int(os.environ.get("REDIS_PORT", "6379")),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )


def _require(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value
