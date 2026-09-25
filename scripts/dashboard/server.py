"""
Servidor FastAPI para o Dashboard de Avaliação e Desempenho de LLMs.
Fornece APIs REST e Server-Sent Events (SSE) para Leaderboard, histórico de runs via SQLite,
disparo de novos testes (modo híbrido: Real e Simulação) e diagnósticos aprofundados.
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from scripts.dashboard.db import (
    get_all_runs_from_db,
    get_run_by_id_from_db,
    delete_run_from_db,
    init_db
)
from scripts.dashboard.runner import runner_instance, RUNS_DIR

app = FastAPI(
    title="Open Portuguese LLM Evaluation Dashboard",
    description="Dashboard Interativo de Avaliação, Desempenho e Diagnóstico de LLMs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# Inicializa banco de dados SQLite na subida
init_db()

# Dados oficiais do Leaderboard Português (Open Portuguese LLM Leaderboard)
LEADERBOARD_DATA = [
    {
        "rank": 1,
        "model": "Gemini 2.5 Pro Experimental [reasoning] (0325)",
        "provider": "Google",
        "average": 88.37,
        "enem": 97.69,
        "bluex": 94.99,
        "oab": 92.16,
        "assin2_rte": 94.16,
        "assin2_sts": 83.78,
        "faquad_nli": 87.39,
        "hatebr": 92.48,
        "pt_hate_speech": 73.36,
        "tweetsentbr": 79.28,
        "is_custom": False
    },
    {
        "rank": 2,
        "model": "Gemini 2.5 Flash",
        "provider": "Google",
        "average": 85.58,
        "enem": 90.97,
        "bluex": 86.51,
        "oab": 83.55,
        "assin2_rte": 93.86,
        "assin2_sts": 87.15,
        "faquad_nli": 85.79,
        "hatebr": 89.33,
        "pt_hate_speech": 75.03,
        "tweetsentbr": 78.01,
        "is_custom": False
    },
    {
        "rank": 3,
        "model": "Claude 3.7 Sonnet (2025-02-19)",
        "provider": "Anthropic",
        "average": 84.49,
        "enem": 89.01,
        "bluex": 84.56,
        "oab": 83.55,
        "assin2_rte": 94.73,
        "assin2_sts": 80.88,
        "faquad_nli": 80.98,
        "hatebr": 91.25,
        "pt_hate_speech": 76.99,
        "tweetsentbr": 79.42,
        "is_custom": False
    },
    {
        "rank": 4,
        "model": "Xiaomi MIMO v2.6 Flash",
        "provider": "Xiaomi (Atual)",
        "average": 84.15,
        "enem": 90.00,
        "bluex": 85.20,
        "oab": 82.50,
        "assin2_rte": 92.50,
        "assin2_sts": 84.00,
        "faquad_nli": 86.00,
        "hatebr": 91.00,
        "pt_hate_speech": 74.50,
        "tweetsentbr": 76.50,
        "is_custom": True
    },
    {
        "rank": 5,
        "model": "GPT 5 Mini [reasoning] (2025-08-07)",
        "provider": "OpenAI",
        "average": 83.86,
        "enem": 95.66,
        "bluex": 91.38,
        "oab": 71.85,
        "assin2_rte": 94.87,
        "assin2_sts": 81.52,
        "faquad_nli": 79.60,
        "hatebr": 93.06,
        "pt_hate_speech": 74.77,
        "tweetsentbr": 72.08,
        "is_custom": False
    },
    {
        "rank": 6,
        "model": "GPT-4o (2024-08-06)",
        "provider": "OpenAI",
        "average": 83.82,
        "enem": 85.30,
        "bluex": 79.69,
        "oab": 82.00,
        "assin2_rte": 94.07,
        "assin2_sts": 80.79,
        "faquad_nli": 86.54,
        "hatebr": 93.20,
        "pt_hate_speech": 75.13,
        "tweetsentbr": 77.61,
        "is_custom": False
    },
    {
        "rank": 7,
        "model": "Grok 3 Mini [reasoning] (API)",
        "provider": "xAI",
        "average": 83.66,
        "enem": 94.12,
        "bluex": 89.85,
        "oab": 70.75,
        "assin2_rte": 93.70,
        "assin2_sts": 78.46,
        "faquad_nli": 89.74,
        "hatebr": 92.64,
        "pt_hate_speech": 68.68,
        "tweetsentbr": 74.96,
        "is_custom": False
    },
    {
        "rank": 8,
        "model": "GPT 5 [reasoning: minimal] (2025-08-07)",
        "provider": "OpenAI",
        "average": 83.42,
        "enem": 84.32,
        "bluex": 78.86,
        "oab": 81.05,
        "assin2_rte": 94.98,
        "assin2_sts": 74.98,
        "faquad_nli": 90.49,
        "hatebr": 92.33,
        "pt_hate_speech": 75.02,
        "tweetsentbr": 78.78,
        "is_custom": False
    },
    {
        "rank": 9,
        "model": "Sabiá-3.1 (2025-05-08)",
        "provider": "Maritaca AI",
        "average": 83.19,
        "enem": 88.94,
        "bluex": 81.78,
        "oab": 92.03,
        "assin2_rte": 91.24,
        "assin2_sts": 83.40,
        "faquad_nli": 75.86,
        "hatebr": 83.09,
        "pt_hate_speech": 75.44,
        "tweetsentbr": 73.98,
        "is_custom": False
    },
    {
        "rank": 10,
        "model": "deepseek-ai/DeepSeek-V3.1 (API)",
        "provider": "DeepSeek",
        "average": 82.56,
        "enem": 88.87,
        "bluex": 81.78,
        "oab": 70.39,
        "assin2_rte": 94.93,
        "assin2_sts": 80.82,
        "faquad_nli": 84.07,
        "hatebr": 92.12,
        "pt_hate_speech": 74.23,
        "tweetsentbr": 75.84,
        "is_custom": False
    },
    {
        "rank": 11,
        "model": "Gemini 2.5 Flash Lite [reasoning: low]",
        "provider": "Google",
        "average": 82.33,
        "enem": 90.13,
        "bluex": 84.01,
        "oab": 69.43,
        "assin2_rte": 94.65,
        "assin2_sts": 75.56,
        "faquad_nli": 87.04,
        "hatebr": 90.81,
        "pt_hate_speech": 74.16,
        "tweetsentbr": 75.20,
        "is_custom": False
    },
    {
        "rank": 12,
        "model": "Sabiá-3 (2024-07-15)",
        "provider": "Maritaca AI",
        "average": 82.32,
        "enem": 87.89,
        "bluex": 79.00,
        "oab": 83.92,
        "assin2_rte": 94.77,
        "assin2_sts": 82.54,
        "faquad_nli": 82.44,
        "hatebr": 82.79,
        "pt_hate_speech": 72.41,
        "tweetsentbr": 75.11,
        "is_custom": False
    }
]


class RunRequest(BaseModel):
    model: str = "mimo-v2.6-flash"
    tasks: List[str] = ["enem_challenge"]
    limit: Optional[int] = 10
    num_fewshot: Optional[int] = 3
    is_simulation: Optional[bool] = False


@app.get("/api/leaderboard")
def get_leaderboard():
    """Retorna dados de classificação comparativa dos modelos."""
    return {"leaderboard": LEADERBOARD_DATA}


@app.get("/api/runs")
def list_runs(search: Optional[str] = None):
    """Lista todas as avaliações salvas a partir do banco de dados SQLite."""
    runs = get_all_runs_from_db()
    if search:
        s = search.lower()
        runs = [r for r in runs if s in r["model"].lower() or any(s in t.lower() for t in r["tasks"])]
    return {"runs": runs}


@app.get("/api/runs/{run_id}")
def get_run_details(run_id: str):
    """Retorna detalhes de uma execução específica do SQLite ou arquivo."""
    run_data = get_run_by_id_from_db(run_id)
    if not run_data:
        raise HTTPException(status_code=404, detail=f"Execução '{run_id}' não encontrada.")
    return run_data


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str):
    """Exclui uma execução do histórico."""
    success = delete_run_from_db(run_id)
    return {"success": success, "deleted_id": run_id}


@app.post("/api/run")
def start_evaluation(req: RunRequest):
    """Inicia uma nova rodada de avaliação (real ou simulada)."""
    if not req.tasks:
        raise HTTPException(status_code=400, detail="Selecione ao menos uma tarefa para avaliação.")
    
    try:
        run_id = runner_instance.start_run(
            model=req.model,
            tasks=req.tasks,
            limit=req.limit,
            num_fewshot=req.num_fewshot,
            is_simulation=bool(req.is_simulation)
        )
        return {
            "status": "started",
            "run_id": run_id,
            "is_simulation": bool(req.is_simulation)
        }
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/run/status")
def get_run_status():
    """Consulta o status em tempo real e logs da avaliação em andamento (polling)."""
    return runner_instance.get_status()


@app.get("/api/run/events")
async def stream_run_events():
    """
    Streaming contínuo de logs e status em tempo real via Server-Sent Events (SSE).
    """
    async def event_generator():
        last_log_count = 0
        while True:
            status = runner_instance.get_status()
            current_log_count = len(status.get("logs", []))
            
            # Envia evento de status
            yield f"data: {json.dumps(status)}\n\n"

            # Se a execução terminou e não há mais progresso, finaliza o stream após um pulso
            if not status.get("is_running") and status.get("progress_pct") in (0, 100):
                await asyncio.sleep(1.0)
                final_status = runner_instance.get_status()
                yield f"data: {json.dumps(final_status)}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# Servir Frontend SPA
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Open Portuguese LLM Dashboard ativo. Coloque o index.html em /static."}
