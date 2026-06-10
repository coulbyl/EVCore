import asyncio
import logging

import uvicorn

from . import config as cfg
from . import worker
from .inference.registry import ModelRegistry
from .inference.server import create_app


def _setup_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


async def main() -> None:
    conf = cfg.load()
    _setup_logging(conf.log_level)

    log = logging.getLogger(__name__)
    log.info("ml-worker starting", extra={"redis_host": conf.redis_host, "redis_port": conf.redis_port})

    registry = ModelRegistry()
    await registry.load(conf.database_url)

    app = create_app(registry)
    server = uvicorn.Server(
        uvicorn.Config(app, host="0.0.0.0", port=8000, log_level=conf.log_level.lower())
    )

    await asyncio.gather(
        server.serve(),
        worker.start(conf),
    )


if __name__ == "__main__":
    asyncio.run(main())
