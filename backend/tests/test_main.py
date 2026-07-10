import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.metadata import generate_commons_wikitext, format_license_template

client = TestClient(app)

def test_health_check():
    """Test the health check endpoint returns 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Service is healthy"}

def test_site_verification_missing():
    """Test that a non-matching site verification filename returns 404."""
    response = client.get("/google12345_nonexistent.html")
    assert response.status_code == 404

def test_license_mapping():
    """Test standard license code mappings to Commons wikitext templates."""
    assert format_license_template("cc-by-sa-4.0") == "{{self|cc-by-sa-4.0}}"
    assert format_license_template("cc-by-4.0") == "{{self|cc-by-4.0}}"
    assert format_license_template("cc0-1.0") == "{{self|cc-zero}}"
    # Default fallback test
    assert format_license_template("unknown-license") == "{{self|cc-by-sa-4.0}}"

def test_generate_commons_wikitext():
    """Test wikitext generation matching the approved template format."""
    wikitext = generate_commons_wikitext(
        description="Farming fields in Vellalore",
        date_str="2026-07-10",
        author_username="AnuUser",
        license_code="cc-by-sa-4.0",
        categories=["Vellalore", "Fields"],
        lat=10.95,
        lon=76.98
    )
    
    assert "Farming fields in Vellalore" in wikitext
    assert "2026-07-10" in wikitext
    assert "User:AnuUser" in wikitext
    assert "{{self|cc-by-sa-4.0}}" in wikitext
    assert "[[Category:Vellalore]]" in wikitext
    assert "[[Category:Fields]]" in wikitext
    assert "{{Location|10.95|76.98}}" in wikitext
