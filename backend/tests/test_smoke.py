from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_testing_infrastructure():
    app = FastAPI()

    @app.get("/health")
    def health_check():
        return {"status": "ok"}

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}