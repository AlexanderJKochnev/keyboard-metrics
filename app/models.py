# app/models.py

from sqlalchemy import Column, Integer, String, Float, DateTime
# from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base  # , sessionmaker


Base = declarative_base()


class KeyMetric(Base):
    __tablename__ = "key_metrics"
    id = Column(Integer, primary_key=True)
    key = Column(String, nullable=True)
    pressed_time = Column(Float, nullable=True)
    released_time = Column(Float, nullable=True)
    duration = Column(Float, nullable=True)
    user_id = Column(Integer)  # Ссылка на пользователя
    test_result_id = Column(Integer)  # ID из comparison_results


class ComparisonResult(Base):
    __tablename__ = "comparison_results"
    id = Column(Integer, primary_key=True)
    input_text = Column(String)
    original_text = Column(String)
    error_count = Column(Integer)
    user_id = Column(Integer)  # Ссылка на пользователя
    completion_percent = Column(Float)  # ← новое поле
    avg_kht = Column(Float)  # среднее время удержания клавиш
    avg_iki = Column(Float)  # средний интервал между нажатиями


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    # В реальном проекте используй хэширование!
    age = Column(Integer)
    gender = Column(String)  # 'male', 'female', 'other'
    created_at = Column(DateTime, server_default="now()")
