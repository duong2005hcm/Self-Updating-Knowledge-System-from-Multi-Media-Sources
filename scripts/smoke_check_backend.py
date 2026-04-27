from __future__ import annotations

import os
import sys
import traceback
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def _env_flag(name: str) -> bool:
    return (os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"})


def _record_ok(message: str) -> None:
    print(f"[OK] {message}")


def _record_skip(message: str) -> None:
    print(f"[SKIP] {message}")


def _record_fail(message: str) -> None:
    print(f"[FAIL] {message}")


def _expect_status(client: TestClient, method: str, path: str, expected: int, **kwargs) -> dict:
    response = client.request(method=method, url=path, **kwargs)
    if response.status_code != expected:
        raise AssertionError(
            f"{method} {path} expected {expected}, got {response.status_code}: {response.text}"
        )
    return response.json() if response.content else {}


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    try:
        from backend.app.app import app
    except Exception:
        _record_fail("App import failed")
        traceback.print_exc()
        return 1

    failures: list[str] = []
    client = TestClient(app)

    try:
        _expect_status(client, "GET", "/", 200)
        _record_ok("GET /")
    except Exception as exc:
        failures.append(str(exc))
        _record_fail(f"GET / -> {exc}")

    try:
        _expect_status(client, "GET", "/api/health", 200)
        _record_ok("GET /api/health")
    except Exception as exc:
        failures.append(str(exc))
        _record_fail(f"GET /api/health -> {exc}")

    keyword_query = os.getenv("SMOKE_SEARCH_QUERY", "test")
    vector_query = os.getenv("SMOKE_VECTOR_QUERY", keyword_query)
    require_search_match = _env_flag("SMOKE_REQUIRE_SEARCH_MATCH")
    try:
        keyword_response = _expect_status(
            client,
            "GET",
            "/api/search",
            200,
            params={
                "search_mode": "keyword",
                "q": keyword_query,
                "limit": 1,
            },
        )
        if require_search_match:
            _assert(int(keyword_response.get("matched_total") or 0) > 0, "Keyword search returned no matches")
        _record_ok("GET /api/search search_mode=keyword")
    except Exception as exc:
        failures.append(str(exc))
        _record_fail(f"GET /api/search keyword -> {exc}")

    admin_token = os.getenv("SMOKE_ADMIN_TOKEN", "").strip()
    admin_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else None

    if admin_headers is None:
        _record_skip("Admin source/document/governance smoke checks need SMOKE_ADMIN_TOKEN")
    else:
        source_id = ""
        source_name = f"Smoke Source {uuid.uuid4().hex[:8]}"
        try:
            created = _expect_status(
                client,
                "POST",
                "/api/sources",
                200,
                headers=admin_headers,
                json={
                    "name": source_name,
                    "type": "web",
                    "url_or_path": f"https://example.com/smoke/{uuid.uuid4().hex}",
                    "domain": "smoke",
                    "active": True,
                    "trust_score": 0.5,
                },
            )
            source_id = created["item"]["id"]
            _record_ok("POST /api/sources")

            _expect_status(
                client,
                "GET",
                f"/api/sources/{source_id}",
                200,
                headers=admin_headers,
            )
            _record_ok("GET /api/sources/{source_id}")

            _expect_status(
                client,
                "GET",
                "/api/sources",
                200,
                headers=admin_headers,
            )
            _record_ok("GET /api/sources")
        except Exception as exc:
            failures.append(str(exc))
            _record_fail(f"Source CRUD smoke -> {exc}")
        finally:
            if source_id:
                try:
                    _expect_status(
                        client,
                        "DELETE",
                        f"/api/sources/{source_id}",
                        200,
                        headers=admin_headers,
                    )
                    _record_ok("DELETE /api/sources/{source_id}")
                except Exception as exc:
                    failures.append(str(exc))
                    _record_fail(f"DELETE source cleanup -> {exc}")

        smoke_document_id = os.getenv("SMOKE_DOCUMENT_ID", "").strip()
        if smoke_document_id:
            try:
                _expect_status(
                    client,
                    "GET",
                    f"/api/documents/{smoke_document_id}",
                    200,
                    headers=admin_headers,
                )
                _record_ok("GET /api/documents/{document_id}")

                public_detail = client.get(f"/api/documents/{smoke_document_id}")
                _assert(public_detail.status_code == 401, f"Public document detail should stay admin-only, got {public_detail.status_code}")
                _record_ok("GET /api/documents/{document_id} stays admin-only")

                versions = _expect_status(
                    client,
                    "GET",
                    f"/api/documents/{smoke_document_id}/versions",
                    200,
                    headers=admin_headers,
                )
                version_items = versions.get("items") or []
                _assert(bool(version_items), "Document versions list is empty")
                latest_version = version_items[0]
                _assert(
                    bool((latest_version.get("raw_path") or "").strip() or (latest_version.get("extracted_text") or "").strip()),
                    "Latest document version is missing both raw_path and extracted_text",
                )
                _record_ok("GET /api/documents/{document_id}/versions")

                chunks = _expect_status(
                    client,
                    "GET",
                    f"/api/documents/{smoke_document_id}/chunks",
                    200,
                    headers=admin_headers,
                )
                chunk_items = chunks.get("items") or []
                _assert(bool(chunk_items), "Document chunks list is empty")
                chunk_indexes = [item.get("chunk_index") for item in chunk_items]
                _assert(all(index is not None for index in chunk_indexes), "Some chunks are missing chunk_index")
                _assert(chunk_indexes == sorted(chunk_indexes), "Chunks are not ordered by chunk_index")
                _record_ok("GET /api/documents/{document_id}/chunks")
            except Exception as exc:
                failures.append(str(exc))
                _record_fail(f"Document read smoke -> {exc}")
        else:
            _record_skip("Document read smoke needs SMOKE_DOCUMENT_ID")

        try:
            _expect_status(
                client,
                "GET",
                "/api/pipeline/jobs",
                200,
                headers=admin_headers,
                params={"limit": 1},
            )
            _record_ok("GET /api/pipeline/jobs")
        except Exception as exc:
            failures.append(str(exc))
            _record_fail(f"Pipeline jobs smoke -> {exc}")

        smoke_ingest_job_id = os.getenv("SMOKE_INGEST_JOB_ID", "").strip()
        if smoke_ingest_job_id:
            try:
                _expect_status(
                    client,
                    "GET",
                    f"/api/pipeline/jobs/{smoke_ingest_job_id}",
                    200,
                    headers=admin_headers,
                )
                _record_ok("GET /api/pipeline/jobs/{job_id}")
            except Exception as exc:
                failures.append(str(exc))
                _record_fail(f"Pipeline job detail smoke -> {exc}")

        governance_document_id = os.getenv("SMOKE_GOVERNANCE_DOCUMENT_ID", "").strip()
        governance_action = os.getenv("SMOKE_GOVERNANCE_ACTION", "reactivate").strip() or "reactivate"
        if governance_document_id:
            try:
                _expect_status(
                    client,
                    "PATCH",
                    f"/api/admin/governance/documents/{governance_document_id}/{governance_action}",
                    200,
                    headers=admin_headers,
                )
                _record_ok(f"PATCH /api/admin/governance/documents/{{document_id}}/{governance_action}")
            except Exception as exc:
                failures.append(str(exc))
                _record_fail(f"Governance smoke -> {exc}")
        else:
            _record_skip("Governance smoke needs SMOKE_GOVERNANCE_DOCUMENT_ID")

    if _env_flag("SMOKE_ENABLE_VECTOR"):
        for mode in ("semantic", "hybrid"):
            try:
                vector_response = _expect_status(
                    client,
                    "GET",
                    "/api/search",
                    200,
                    params={
                        "search_mode": mode,
                        "q": vector_query,
                        "limit": 1,
                    },
                )
                if require_search_match:
                    _assert(int(vector_response.get("matched_total") or 0) > 0, f"{mode} search returned no matches")
                _record_ok(f"GET /api/search search_mode={mode}")
            except Exception as exc:
                failures.append(str(exc))
                _record_fail(f"GET /api/search {mode} -> {exc}")
    else:
        _record_skip("Vector smoke checks disabled; set SMOKE_ENABLE_VECTOR=1 to run semantic/hybrid")

    if failures:
        print(f"\nSmoke check failed: {len(failures)} issue(s)")
        return 1

    print("\nSmoke check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
