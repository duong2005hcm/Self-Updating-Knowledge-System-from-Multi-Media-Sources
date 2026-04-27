from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

load_dotenv(ROOT / ".env")

from backend.app.repositories.article_repository import ArticleRepository
from backend.app.services.article_service import ArticleService
from backend.app.services.external_news_ingest_service import (
    SOURCE_ALL,
    ExternalNewsIngestService,
)


logger = logging.getLogger("external_news_ingest")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run one manual/scheduled external news ingest pass.",
    )
    parser.add_argument(
        "--source",
        "--source-name",
        dest="source_name",
        default=SOURCE_ALL,
        help="Source to ingest: all | pubmed | europe_pmc | moh",
    )
    parser.add_argument(
        "--limit-per-source",
        type=int,
        default=2,
        help="Max articles per source. Hard-capped by service to 1-2.",
    )
    parser.add_argument(
        "--query",
        default="medicine",
        help="Query for PubMed/Europe PMC sources.",
    )
    parser.add_argument(
        "--topic",
        default="health",
        help="Article topic metadata.",
    )
    parser.add_argument(
        "--tag",
        action="append",
        default=[],
        help="Extra tag. Can be repeated.",
    )
    parser.add_argument(
        "--allow-partial-success",
        action="store_true",
        help="Exit 0 even if one source fails but others finish.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    args = _build_parser().parse_args(argv)

    repository = ArticleRepository()
    article_service = ArticleService(repository)
    ingest_service = ExternalNewsIngestService(article_service)

    try:
        result = ingest_service.ingest(
            source_name=args.source_name,
            limit_per_source=args.limit_per_source,
            query=args.query,
            topic=args.topic,
            tags=args.tag,
        )
    except Exception:
        logger.exception("external_news_ingest_failed")
        return 1

    logger.info(
        "external_news_ingest_done source=%s limit_per_source=%s created_count=%s skipped_count=%s failed_count=%s",
        result.source_name,
        result.limit_per_source,
        result.created_count,
        result.skipped_count,
        result.failed_count,
    )
    for source in result.sources:
        logger.info(
            "external_news_source_done source=%s created_count=%s skipped_count=%s failed_count=%s error=%s",
            source.source_name,
            source.created_count,
            source.skipped_count,
            source.failed_count,
            source.error or "",
        )
    for item in result.items:
        logger.info(
            "external_news_item source=%s action=%s article_id=%s title=%s",
            item.source_name,
            item.action,
            item.article_id,
            item.title,
        )

    if result.failed_count and not args.allow_partial_success:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
