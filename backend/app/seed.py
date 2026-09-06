"""Run explicitly with `python -m app.seed` after `alembic upgrade head`."""
import asyncio

from app.db.session import async_session_factory, engine
from app.repositories.seed import seed_dictionaries


async def main() -> None:
    try:
        async with async_session_factory.begin() as session:
            await seed_dictionaries(session)
        print("Справочники типов животных и пород готовы.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
