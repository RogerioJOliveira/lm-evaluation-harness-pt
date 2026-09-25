import os
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
from scripts.dashboard.server import app
from scripts.dashboard.db import (
    init_db,
    save_run_to_db,
    get_all_runs_from_db,
    get_run_by_id_from_db,
    delete_run_from_db
)

client = TestClient(app)


def test_leaderboard_endpoint():
    """Valida o endpoint do Leaderboard Oficial."""
    response = client.get("/api/leaderboard")
    assert response.status_code == 200
    data = response.json()
    assert "leaderboard" in data
    assert len(data["leaderboard"]) >= 5
    # Verifica que Gemini 2.5 Pro ou Xiaomi MIMO estão presentes
    models = [m["model"] for m in data["leaderboard"]]
    assert any("Xiaomi MIMO" in m for m in models)


def test_sqlite_persistence():
    """Valida o ciclo de vida de persistência no SQLite."""
    init_db()
    test_run_id = "test_run_sqlite_001"
    
    mock_run = {
        "id": test_run_id,
        "model": "pytest-model",
        "tasks": ["enem_challenge"],
        "limit": 2,
        "num_fewshot": 0,
        "timestamp": "2026-09-25 12:00:00",
        "duration_seconds": 1.5,
        "status": "completed",
        "is_simulation": True,
        "metrics": {"acc": 1.0},
        "questions": [
            {
                "id": "q1",
                "task": "enem_challenge",
                "category": "Matemática",
                "question": "Quanto é 2 + 2?",
                "choices": ["A) 3", "B) 4"],
                "gold": "B",
                "model_choice": "B",
                "is_correct": True,
                "explanation": "2+2=4"
            }
        ],
        "diagnostics": {
            "summary": {"total": 1, "correct": 1, "wrong": 0, "accuracy": 100.0}
        }
    }

    # Salva
    save_run_to_db(mock_run)

    # Recupera por ID
    retrieved = get_run_by_id_from_db(test_run_id)
    assert retrieved is not None
    assert retrieved["id"] == test_run_id
    assert retrieved["model"] == "pytest-model"
    assert len(retrieved["questions"]) == 1
    assert retrieved["questions"][0]["is_correct"] is True

    # Lista todas
    all_runs = get_all_runs_from_db()
    assert any(r["id"] == test_run_id for r in all_runs)

    # Deleta
    delete_run_from_db(test_run_id)
    assert get_run_by_id_from_db(test_run_id) is None


def test_runs_api_endpoints():
    """Valida endpoints /api/runs e /api/runs/{id}."""
    res_list = client.get("/api/runs")
    assert res_list.status_code == 200
    runs = res_list.json().get("runs", [])
    assert isinstance(runs, list)

    if runs:
        first_id = runs[0]["id"]
        res_detail = client.get(f"/api/runs/{first_id}")
        assert res_detail.status_code == 200
        data = res_detail.json()
        assert "questions" in data
        assert "diagnostics" in data


def test_simulation_run_execution():
    """Valida o disparo de uma execução simulada via API."""
    payload = {
        "model": "mimo-v2.6-flash",
        "tasks": ["enem_challenge"],
        "limit": 3,
        "num_fewshot": 0,
        "is_simulation": True
    }

    response = client.post("/api/run", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "started"
    assert res_data["is_simulation"] is True
    run_id = res_data["run_id"]

    # Aguarda a conclusão da simulação
    max_wait = 10
    start = time.time()
    finished = False
    while time.time() - start < max_wait:
        status_res = client.get("/api/run/status")
        assert status_res.status_code == 200
        st = status_res.json()
        if not st.get("is_running") and st.get("progress_pct") == 100:
            finished = True
            break
        time.sleep(0.5)

    assert finished, "A execução simulada não concluiu dentro do tempo esperado."

    # Verifica se os detalhes do run podem ser carregados do banco/API
    details_res = client.get(f"/api/runs/{run_id}")
    assert details_res.status_code == 200
    run_data = details_res.json()
    assert run_data["id"] == run_id
    assert len(run_data["questions"]) > 0
    assert "summary" in run_data["diagnostics"]


def test_frontend_index_served():
    """Valida se a página principal do dashboard é servida corretamente."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Open Portuguese LLM Benchmark" in response.text


if __name__ == "__main__":
    print("▶ Executando test_leaderboard_endpoint()...")
    test_leaderboard_endpoint()
    print("✔ Leaderboard OK!")

    print("▶ Executando test_sqlite_persistence()...")
    test_sqlite_persistence()
    print("✔ SQLite Persistence OK!")

    print("▶ Executando test_runs_api_endpoints()...")
    test_runs_api_endpoints()
    print("✔ Runs API OK!")

    print("▶ Executando test_simulation_run_execution()...")
    test_simulation_run_execution()
    print("✔ Simulation Run Execution OK!")

    print("▶ Executando test_frontend_index_served()...")
    test_frontend_index_served()
    print("✔ Frontend Index Served OK!")

    print("\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!")
