"""
Script de inicialização do Dashboard de Avaliação de LLMs.
Executa o servidor FastAPI com Uvicorn e abre o navegador automaticamente.
Uso:
    py -3.12 scripts/dashboard/run_dashboard.py
"""

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

# Adiciona o diretório raiz do projeto ao PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Carrega variáveis de ambiente do .env se existir
env_path = ROOT_DIR / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path)
    except ImportError:
        pass


def open_browser(url: str):
    time.sleep(1.2)
    print(f"\n🌐 Abrindo navegador em: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Não foi possível abrir o navegador automaticamente: {e}")


def main():
    import uvicorn

    host = "127.0.0.1"
    port = 8000
    url = f"http://{host}:{port}"

    print("=" * 70)
    print(" 🚀 OPEN PORTUGUESE LLM BENCHMARK - DASHBOARD DE DESEMPENHO ")
    print("=" * 70)
    print(f"📍 Servidor iniciando em: {url}")
    print("📊 5 Visões disponíveis:")
    print("   1. Leaderboard Geral (Open Portuguese LLM Benchmark)")
    print("   2. Executor de Testes & Monitor de Logs em Tempo Real")
    print("   3. Inspetor de Questões (Filtro de Acertos 🟢 e Erros 🔴)")
    print("   4. Desempenho por Categorias e Disciplinas")
    print("   5. Sugestões Automáticas de Melhorias & Insights da IA")
    print("-" * 70)
    print("Pressione CTRL+C a qualquer momento para encerrar o servidor.")
    print("=" * 70)

    # Thread para abrir o navegador
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    # Inicia Uvicorn
    uvicorn.run(
        "scripts.dashboard.server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
