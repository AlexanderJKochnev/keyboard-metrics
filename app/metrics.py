# app/metrics.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import KeyMetric, ComparisonResult
# from typing import Optional, List
import numpy as np


async def calculate_kht(usr_id: int,
                        test_res_id: int,
                        db: AsyncSession) -> float:
    result = await db.execute(
        select(KeyMetric.duration).where(
            KeyMetric.user_id == usr_id,
            KeyMetric.test_result_id == test_res_id
        )
    )

    durations = result.scalars().all()
    if not durations:
        return 0.0

    return round(np.mean(durations), 2)


async def calculate_iki(usr_id: int,
                        test_res_id: int,
                        db: AsyncSession) -> float:
    result = await db.execute(
        select(KeyMetric.released_time).where(
            KeyMetric.user_id == usr_id,
            KeyMetric.test_result_id == test_res_id
        ).order_by(KeyMetric.released_time.asc())
    )

    timestamps = result.scalars().all()
    if len(timestamps) < 2:
        return 0.0

    iki_list = [timestamps[i+1] - timestamps[i]
                for i in range(len(timestamps) - 1)]
    return round(np.mean(iki_list), 2)


async def attach_metrics_to_test(test_res_id: int, db: AsyncSession):
    # Получаем тестовый результат
    test_result = await db.get(ComparisonResult, test_res_id)
    if not test_result:
        raise ValueError("Результат теста не найден")

    # Рассчитываем метрики
    kht = await calculate_kht(test_result.user_id, test_res_id, db)
    iki = await calculate_iki(test_result.user_id, test_res_id, db)

    # Обновляем запись с тестом
    test_result.avg_kht = kht
    test_result.avg_iki = iki

    try:
        await db.commit()
        await db.refresh(test_result)
        return test_result
    except Exception as e:
        await db.rollback()
        raise e
