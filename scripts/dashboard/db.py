"""
Camada de Persistência SQLite para o Dashboard de Avaliação de LLMs.
Gerencia histórico de runs, questões detalhadas e diagnósticos estatísticos.
Sincroniza automaticamente com arquivos .json em scripts/dashboard/runs.
"""

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().parent / "dashboard.db"
RUNS_DIR = Path(__file__).resolve().parent / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Inicializa as tabelas do banco SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        tasks_json TEXT NOT NULL,
        limit_samples INTEGER,
        num_fewshot INTEGER,
        timestamp TEXT NOT NULL,
        duration_seconds REAL,
        status TEXT NOT NULL,
        accuracy REAL,
        total_questions INTEGER,
        is_simulation INTEGER DEFAULT 0,
        metrics_json TEXT,
        diagnostics_json TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        question_id TEXT,
        task TEXT NOT NULL,
        category TEXT,
        question_text TEXT,
        choices_json TEXT,
        gold_choice TEXT,
        model_choice TEXT,
        is_correct INTEGER,
        explanation TEXT,
        FOREIGN KEY (run_id) REFERENCES runs (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_run ON questions(run_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_correct ON questions(is_correct);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);")

    conn.commit()
    conn.close()

    # Sincroniza runs legadas em JSON para o banco SQLite
    sync_json_runs_to_db()


def save_run_to_db(run_data: Dict[str, Any]):
    """Salva ou atualiza uma execução completa no SQLite."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    run_id = run_data.get("id")
    model = run_data.get("model", "unknown")
    tasks = json.dumps(run_data.get("tasks", []), ensure_ascii=False)
    limit = run_data.get("limit")
    num_fewshot = run_data.get("num_fewshot")
    timestamp = run_data.get("timestamp", "")
    duration = run_data.get("duration_seconds", 0.0)
    status = run_data.get("status", "completed")
    is_simulation = 1 if run_data.get("is_simulation") else 0

    diag = run_data.get("diagnostics", {})
    summary = diag.get("summary", {})
    accuracy = summary.get("accuracy", 0.0)
    total_q = summary.get("total", len(run_data.get("questions", [])))

    metrics_json = json.dumps(run_data.get("metrics", {}), ensure_ascii=False)
    diag_json = json.dumps(diag, ensure_ascii=False)

    cursor.execute("""
    INSERT OR REPLACE INTO runs (
        id, model, tasks_json, limit_samples, num_fewshot,
        timestamp, duration_seconds, status, accuracy, total_questions,
        is_simulation, metrics_json, diagnostics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        run_id, model, tasks, limit, num_fewshot,
        timestamp, duration, status, accuracy, total_q,
        is_simulation, metrics_json, diag_json
    ))

    # Limpa questões anteriores desse run (se houver atualização)
    cursor.execute("DELETE FROM questions WHERE run_id = ?", (run_id,))

    # Insere questões
    questions = run_data.get("questions", [])
    for q in questions:
        choices = json.dumps(q.get("choices", []), ensure_ascii=False)
        is_corr = 1 if q.get("is_correct") else 0
        cursor.execute("""
        INSERT INTO questions (
            run_id, question_id, task, category, question_text,
            choices_json, gold_choice, model_choice, is_correct, explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            str(q.get("id", "")),
            q.get("task", ""),
            q.get("category", "Geral"),
            q.get("question", ""),
            choices,
            q.get("gold", ""),
            q.get("model_choice", ""),
            is_corr,
            q.get("explanation", "")
        ))

    conn.commit()
    conn.close()


def sync_json_runs_to_db():
    """Importa automaticamente arquivos JSON em scripts/dashboard/runs para o SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    existing_ids = set(row[0] for row in cursor.execute("SELECT id FROM runs").fetchall())

    for json_file in RUNS_DIR.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            run_id = data.get("id") or json_file.stem
            if run_id not in existing_ids:
                data["id"] = run_id
                save_run_to_db(data)
                existing_ids.add(run_id)
        except Exception:
            continue

    conn.close()


def get_all_runs_from_db() -> List[Dict[str, Any]]:
    """Recupera lista de todas as execuções do SQLite ordenadas por data desc."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, model, tasks_json, limit_samples, num_fewshot,
           timestamp, duration_seconds, status, accuracy, total_questions, is_simulation
    FROM runs
    ORDER BY timestamp DESC
    """)
    rows = cursor.fetchall()
    runs = []
    for r in rows:
        runs.append({
            "id": r["id"],
            "model": r["model"],
            "tasks": json.loads(r["tasks_json"]) if r["tasks_json"] else [],
            "limit": r["limit_samples"],
            "num_fewshot": r["num_fewshot"],
            "timestamp": r["timestamp"],
            "duration_seconds": r["duration_seconds"],
            "status": r["status"],
            "accuracy": r["accuracy"],
            "total_questions": r["total_questions"],
            "is_simulation": bool(r["is_simulation"]),
            "file_name": f"{r['id']}.json"
        })

    conn.close()
    return runs


def get_run_by_id_from_db(run_id: str) -> Optional[Dict[str, Any]]:
    """Recupera os detalhes completos de um run do SQLite."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
    run_row = cursor.fetchone()

    if not run_row:
        conn.close()
        # Fallback para JSON direto
        json_file = RUNS_DIR / f"{run_id}.json"
        if json_file.exists():
            with open(json_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    # Busca as questões
    cursor.execute("""
    SELECT question_id, task, category, question_text, choices_json,
           gold_choice, model_choice, is_correct, explanation
    FROM questions
    WHERE run_id = ?
    ORDER BY id ASC
    """, (run_id,))
    q_rows = cursor.fetchall()

    questions = []
    for q in q_rows:
        questions.append({
            "id": q["question_id"],
            "task": q["task"],
            "category": q["category"],
            "question": q["question_text"],
            "choices": json.loads(q["choices_json"]) if q["choices_json"] else [],
            "gold": q["gold_choice"],
            "model_choice": q["model_choice"],
            "is_correct": bool(q["is_correct"]),
            "explanation": q["explanation"]
        })

    run_dict = {
        "id": run_row["id"],
        "model": run_row["model"],
        "tasks": json.loads(run_row["tasks_json"]) if run_row["tasks_json"] else [],
        "limit": run_row["limit_samples"],
        "num_fewshot": run_row["num_fewshot"],
        "timestamp": run_row["timestamp"],
        "duration_seconds": run_row["duration_seconds"],
        "status": run_row["status"],
        "is_simulation": bool(run_row["is_simulation"]),
        "metrics": json.loads(run_row["metrics_json"]) if run_row["metrics_json"] else {},
        "diagnostics": json.loads(run_row["diagnostics_json"]) if run_row["diagnostics_json"] else {},
        "questions": questions
    }

    conn.close()
    return run_dict


def delete_run_from_db(run_id: str) -> bool:
    """Exclui um run do SQLite e o arquivo correspondente em disco."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM questions WHERE run_id = ?", (run_id,))
    cursor.execute("DELETE FROM runs WHERE id = ?", (run_id,))
    conn.commit()
    conn.close()

    json_file = RUNS_DIR / f"{run_id}.json"
    if json_file.exists():
        try:
            json_file.unlink()
        except Exception:
            pass

    return True
