"""Public GET /schools/by-slug/{slug} — the first unauthenticated endpoint.
Pins what it exposes (id + name only) and that unknown slugs 404."""
from conftest import SCHOOL_ID, SCHOOL_SLUG


def test_by_slug_returns_id_and_name(client, seed):
    r = client.get(f"/schools/by-slug/{SCHOOL_SLUG}")
    assert r.status_code == 200
    body = r.json()
    assert body == {"id": SCHOOL_ID, "name": "Test Academy"}


def test_by_slug_exposes_nothing_beyond_id_and_name(client, seed):
    # Guard against accidentally widening the SELECT to leak invite_code, etc.
    body = client.get(f"/schools/by-slug/{SCHOOL_SLUG}").json()
    assert set(body.keys()) == {"id", "name"}


def test_by_slug_unknown_returns_404(client, seed):
    r = client.get("/schools/by-slug/does-not-exist")
    assert r.status_code == 404


def test_by_slug_requires_no_auth(client, seed):
    # No Authorization header at all — must still succeed.
    r = client.get(f"/schools/by-slug/{SCHOOL_SLUG}")
    assert r.status_code == 200
