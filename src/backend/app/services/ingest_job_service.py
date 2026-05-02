from __future__ import annotations

import logging
from typing import Optional

from backend.app.models.ingest_job import IngestJob
from backend.app.repositories.ingest_job_repository import IngestJobRepository

logger = logging.getLogger(__name__)


class IngestJobNotFoundError(Exception):
    pass


class IngestJobService:
    def __init__(self, repository: Optional[IngestJobRepository] = None):
        self._repository = repository or IngestJobRepository()

    def start_job(self, *, source_id: str, job_id: Optional[str] = None) -> IngestJob:
        job = IngestJob.create(source_id=source_id, job_id=job_id, status="running")
        self._repository.create_job(job)
        return job

    def list_jobs(
        self,
        *,
        limit: int = 50,
        status: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> list[IngestJob]:
        return self._repository.list_jobs(
            limit=limit,
            status=status,
            source_id=source_id,
        )

    def get_job(self, job_id: str) -> IngestJob:
        job = self._repository.get_job_by_id(job_id)
        if job is None:
            raise IngestJobNotFoundError(f"Ingest job not found: {job_id}")
        return job

    def increment_counters(
        self,
        job_id: str,
        *,
        processed_count: int = 0,
        created_count: int = 0,
        updated_count: int = 0,
        skipped_count: int = 0,
        failed_count: int = 0,
    ) -> None:
        self._repository.increment_counters(
            job_id,
            processed_count=processed_count,
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
        )

    def finish_job(self, job_id: str) -> None:
        self._repository.finish_job(job_id)

    def fail_job(self, job_id: str, error: str) -> None:
        logger.error("Ingest job failed [%s]: %s", job_id, error)
        self._repository.fail_job(job_id, error)
