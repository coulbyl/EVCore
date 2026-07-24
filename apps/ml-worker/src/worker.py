import asyncio
import logging
from typing import Any

from bullmq import Worker

from .config import Config
from .jobs import train

logger = logging.getLogger(__name__)

QUEUE_NAME = "ml-training"

_HANDLERS = {
    "train": train.handle,
}


async def start(config: Config) -> None:
    connection = {"host": config.redis_host, "port": config.redis_port}

    async def process(job: Any, token: str) -> Any:  # noqa: ARG001
        handler = _HANDLERS.get(job.name)
        if handler is None:
            logger.warning("unknown job name, skipping", extra={"job_name": job.name})
            return None
        try:
            return await handler(job.data, config)
        except Exception:
            logger.exception("job failed", extra={"job_name": job.name})
            raise

    concurrency = 1
    worker = Worker(
        QUEUE_NAME,
        process,
        {"connection": connection, "concurrency": concurrency},
    )
    logger.info(
        "worker listening",
        extra={"queue": QUEUE_NAME, "redis": connection, "concurrency": concurrency},
    )

    try:
        await asyncio.Event().wait()
    finally:
        await worker.close()
