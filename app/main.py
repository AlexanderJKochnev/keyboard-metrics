# app/main.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
# from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
import os
import httpx
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select
from typing import Optional


# Загрузка переменных окружения
load_dotenv()

# Импорт моделей
from app.models import Base, KeyMetric, ComparisonResult, User  # NOQA: E402

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="templates"), name="static")
# Логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Настройки БД
# "postgresql+asyncpg://
sources = ['postgresql+asyncpg://',
           'POSTGRES_USER', ':',
           'POSTGRES_PASSWORD', '@',
           'POSTGRES_HOST', '/',
           'POSTGRES_DB']
DATABASE_URL = ''.join(os.getenv(a, a) for a in sources)
print('--------------------------------------')
print(DATABASE_URL)

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine,
                             class_=AsyncSession,
                             expire_on_commit=False)


# === Pydantic модели ===
class KeyData(BaseModel):
    key: str
    pressed_time: float
    released_time: float
    duration: float


class ComparisonResultModel(BaseModel):
    input_text: str
    original_text: str
    errors: int


# === Асинхронная зависимость для получения сессии ===
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as db:
        yield db


# === Инициализация БД ===
@app.on_event("startup")
async def startup_event():
    logger.info("Создание таблиц в БД...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Таблицы успешно созданы")


# === Эндпоинты ===

@app.get("/")
async def read_index():
    return FileResponse("templates/index.html")


@app.get("/get-text")
async def get_random_text():
    number = int(os.getenv("TEXT_LENGTH", 2))
    text_type = os.getenv("TEXT_TYPE", "paragraph")
    url = os.getenv("TEXT_SOURCE_URL", "https://fish-text.ru/get")
    params = {
        "type": text_type,
        "number": number,
        "format": "json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            if data["status"] == "success":
                return {"text": data["text"]}
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Ошибка API: {data.get('text',
                                                   'Неизвестная ошибка')}"
                )
    except Exception as e:
        logger.error(f"Ошибка получения текста: {e}")
        raise HTTPException(status_code=500,
                            detail="Не удалось загрузить текст")


@app.post("/add_metric")
async def add_metric(metric: KeyData, db: AsyncSession = Depends(get_db)):
    db_metric = KeyMetric(**metric.dict())
    db.add(db_metric)
    try:
        await db.commit()
        await db.refresh(db_metric)
        return {"status": "ok"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка сохранения метрик: {e}")
        return {"error": str(e)}


@app.post("/compare")
async def compare_text(result: ComparisonResultModel,
                       db: AsyncSession = Depends(get_db)):
    input_text = result.input_text
    original_text = result.original_text

    min_len = min(len(input_text), len(original_text))
    errors = sum(
        1 for i in range(min_len) if input_text[i] != original_text[i]
    )
    errors += abs(len(input_text) - len(original_text))

    db_result = ComparisonResult(
        input_text=input_text,
        original_text=original_text,
        error_count=errors
    )
    db.add(db_result)
    try:
        await db.commit()
        await db.refresh(db_result)
        return {"errors": errors}
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка сохранения результата сравнения: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка БД: {str(e)}"
        )


# === Pydantic модели для пользователя ===
class UserCreate(BaseModel):
    username: str
    password: str
    age: Optional[int] = None
    gender: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


# === Эндпоинты для пользователя ===
@app.post("/register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username
                                                 == user.username))
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(status_code=400,
                            detail="Пользователь уже существует")

    db_user = User(**user.dict())
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return {"status": "ok", "user_id": db_user.id}


@app.post("/login")
async def login_user(credentials: UserLogin,
                     db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username ==
                                                 credentials.username))
    user = result.scalars().first()

    if not user or user.password != credentials.password:
        raise HTTPException(status_code=400,
                            detail="Неверный логин или пароль")

    return {"status": "ok", "user_id": user.id}
