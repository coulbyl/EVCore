import asyncio
import logging

from . import config as cfg
from . import worker


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

    await worker.start(conf)


if __name__ == "__main__":
    asyncio.run(main())
