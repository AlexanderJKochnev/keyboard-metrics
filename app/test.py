from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text  # <-- импортируем text

DATABASE_URL = "postgresql+asyncpg://metrics:alzheimer@postgres_db/metrics_db"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_connection():
    async with async_session() as session:
        result = await session.execute(text("SELECT 1"))  # <-- оборачиваем в text()
        print(result.scalar())

# Запуск в асинхронной среде
import asyncio
asyncio.run(test_connection())