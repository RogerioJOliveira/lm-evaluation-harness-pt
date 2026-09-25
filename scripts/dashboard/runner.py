"""
Executor assíncrono de avaliações com captura de logs em tempo real e modo híbrido (Real + Simulação).
Salva os resultados simultaneamente no banco SQLite e em arquivos JSON.
"""

import io
import json
import logging
import os
import random
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from scripts.dashboard.diagnostics import extract_question_details, analyze_diagnostics, infer_subject
from scripts.dashboard.db import save_run_to_db

RUNS_DIR = Path(__file__).resolve().parent / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)


class EvaluationRunner:
    def __init__(self):
        self.lock = threading.Lock()
        self.is_running = False
        self.current_run_id: Optional[str] = None
        self.progress_pct: int = 0
        self.current_task: str = ""
        self.logs: List[str] = []
        self.error: Optional[str] = None
        self.start_time: Optional[float] = None
        self.is_simulation: bool = False

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            elapsed = 0.0
            if self.start_time and self.is_running:
                elapsed = time.time() - self.start_time
            return {
                "is_running": self.is_running,
                "run_id": self.current_run_id,
                "progress_pct": self.progress_pct,
                "current_task": self.current_task,
                "logs": self.logs[-100:],  # Últimas 100 linhas
                "error": self.error,
                "elapsed_seconds": round(elapsed, 1),
                "is_simulation": self.is_simulation
            }

    def append_log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}"
        with self.lock:
            self.logs.append(line)
            if len(self.logs) > 1000:
                self.logs.pop(0)

    def start_run(
        self,
        model: str,
        tasks: List[str],
        limit: Optional[int] = 10,
        num_fewshot: Optional[int] = None,
        is_simulation: bool = False,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> str:
        with self.lock:
            if self.is_running:
                raise RuntimeError("Já existe um teste em execução no momento.")
            self.is_running = True
            self.progress_pct = 5
            self.logs = []
            self.error = None
            self.start_time = time.time()
            self.is_simulation = is_simulation
            mode_prefix = "sim" if is_simulation else "run"
            clean_model = model.replace("/", "_").replace("-", "_").replace(" ", "_")
            run_id = f"{mode_prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{clean_model}"
            self.current_run_id = run_id
            self.current_task = f"Iniciando {'simulação' if is_simulation else 'avaliação real'} para {model}..."

        thread = threading.Thread(
            target=self._run_worker,
            args=(run_id, model, tasks, limit, num_fewshot, is_simulation, base_url, api_key),
            daemon=True
        )
        thread.start()
        return run_id

    def _run_worker(
        self,
        run_id: str,
        model_name: str,
        task_list: List[str],
        limit: Optional[int],
        num_fewshot: Optional[int],
        is_simulation: bool,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        if is_simulation:
            self._execute_simulation(run_id, model_name, task_list, limit or 10, num_fewshot)
        else:
            self._execute_real(run_id, model_name, task_list, limit, num_fewshot, base_url, api_key)

    def _execute_simulation(
        self,
        run_id: str,
        model_name: str,
        task_list: List[str],
        limit: int,
        num_fewshot: Optional[int]
    ):
        """Executa simulação realista gerando questões ricas e relatórios imediatos."""
        self.append_log(f"⚡ [MODO SIMULAÇÃO ATIVO] Executando benchmark simulado para {model_name}")
        self.append_log(f"Tarefas: {', '.join(task_list)} | Limite de amostras por tarefa: {limit}")

        time.sleep(0.4)
        with self.lock:
            self.progress_pct = 20
            self.current_task = "Carregando catálogo de tarefas e instanciando avaliadores..."
        self.append_log("Catálogo de tarefas verificado com sucesso.")

        time.sleep(0.5)
        with self.lock:
            self.progress_pct = 40
            self.current_task = f"Processando inferências para: {', '.join(task_list)}"

        # Amostras simuladas realistas por categoria
        sample_questions_bank = [
            {
                "task": "enem_challenge",
                "category": "Matemática e Exatas",
                "question": "Um produtor de café contratou uma empresa de logística para transportar sua safra. A empresa cobra uma taxa fixa de R$ 500,00 mais R$ 2,50 por quilômetro rodado. Para um trajeto de 320 km, qual será o valor total a ser pago pelo transporte?",
                "choices": ["R$ 1.100,00", "R$ 1.250,00", "R$ 1.300,00", "R$ 1.450,00", "R$ 1.500,00"],
                "gold": "C",
                "has_negation": False,
                "explanation": "Cálculo: 500 + (2.50 * 320) = 500 + 800 = 1300."
            },
            {
                "task": "enem_challenge",
                "category": "Ciências da Natureza (Física, Química, Biologia)",
                "question": "Durante a fotossíntese nas plantas terrestres, a fase clara ocorre nos tilacoides e resulta na liberação de oxigênio proveniente da quebra da molécula de água. Qual dos seguintes compostos NÃO participa diretamente do ciclo de Calvin?",
                "choices": ["ATP", "NADPH", "CO2", "Ribulose-1,5-bisfosfato", "Clorofila a"],
                "gold": "E",
                "has_negation": True,
                "explanation": "A clorofila atua diretamente na fase fotoquímica nos tilacoides e não no ciclo de Calvin no estroma."
            },
            {
                "task": "enem_challenge",
                "category": "Ciências Humanas (História, Geografia, Filosofia)",
                "question": "A Constituição brasileira de 1988, conhecida como a Constituição Cidadã, representou o marco da redemocratização após o regime militar. Entre suas principais inovações sociais, destaca-se:",
                "choices": [
                    "A extinção do sufrágio universal para analfabetos",
                    "A criação do Sistema Único de Saúde (SUS) e universalização do acesso",
                    "A censura prévia institucionalizada para meios de comunicação",
                    "A revogação do habeas corpus em crimes políticos",
                    "O mandato presidencial vitalício"
                ],
                "gold": "B",
                "has_negation": False,
                "explanation": "O artigo 196 instituiu a saúde como direito de todos e dever do Estado, viabilizando o SUS."
            },
            {
                "task": "enem_challenge",
                "category": "Linguagens e Códigos",
                "question": "No poema modernista, a ruptura com o parnasianismo manifestou-se sobretudo pelo uso de versos livres e pela incorporação da fala coloquial. Assinale a alternativa que NÃO corresponde a uma característica do Modernismo de 1922:",
                "choices": [
                    "Valorização do cotidiano nacional",
                    "Rigor métrico e rimas ricas obrigatórias",
                    "Ironia e humor crítico",
                    "Nacionalismo crítico e antropofagia cultural",
                    "Liberdade formal e estética"
                ],
                "gold": "B",
                "has_negation": True,
                "explanation": "O rigor métrico e rimas ricas eram característicos do Parnasianismo, justamente o movimento combatido."
            },
            {
                "task": "oab_exams",
                "category": "Direito Constitucional & Teoria do Estado",
                "question": "Determinado Governador de Estado editou decreto regulamentando matéria sobre direito penal e processual penal. À luz da Constituição Federal de 1988, essa norma estadual é:",
                "choices": [
                    "Constitucional, pois os Estados têm competência concorrente em matéria penal.",
                    "Inconstitucional, pois legislar sobre direito penal é competência privativa da União.",
                    "Válida temporariamente até a edição de lei federal em sentido contrário.",
                    "Constitucional se referendada pela Assembleia Legislativa em 30 dias."
                ],
                "gold": "B",
                "has_negation": False,
                "explanation": "Artigo 22, I da CF/88 estabelece competência privativa da União para legislar sobre direito penal e processual."
            },
            {
                "task": "oab_exams",
                "category": "Direito Penal & Processo Penal",
                "question": "Tício subtraiu para si, mediante grave ameaça exercida com simulação de arma de fogo, um aparelho celular de Caio. Tipifica-se a conduta como:",
                "choices": [
                    "Furto qualificado por fraude",
                    "Roubo simples consumado",
                    "Extorsão mediante sequestro",
                    "Apropriação indébita"
                ],
                "gold": "B",
                "has_negation": False,
                "explanation": "A grave ameaça (inclusive com simulacro de arma) configura o crime de roubo (art. 157 do CP), não furto."
            },
            {
                "task": "oab_exams",
                "category": "Ética Profissional OAB",
                "question": "Um advogado foi procurado por cliente para atuar em causa contra ex-empregador com quem manteve vínculo empregatício como advogado interno até dois meses atrás. Nos termos do Estatuto da OAB, o advogado:",
                "choices": [
                    "Pode atuar livremente sem qualquer restrição temporal.",
                    "Deve recusar o patrocínio por violar dever de sigilo e período de quarentena.",
                    "Só pode atuar mediante expressa autorização do Tribunal de Justiça.",
                    "Pode atuar caso cobre honorários abaixo da tabela da OAB."
                ],
                "gold": "B",
                "has_negation": False,
                "explanation": "O Código de Ética veda a advocacia contra ex-cliente/empregador recente por preservação de sigilo profissional."
            },
            {
                "task": "bluex",
                "category": "Ciências da Natureza (Física, Química, Biologia)",
                "question": "Um corpo de massa 2 kg move-se em linha reta com aceleração constante de 3 m/s². Desprezando o atrito com o ar, a força resultante aplicada sobre o corpo é de:",
                "choices": ["1,5 N", "5,0 N", "6,0 N", "9,0 N", "12,0 N"],
                "gold": "C",
                "has_negation": False,
                "explanation": "Pela Segunda Lei de Newton: F = m * a = 2 * 3 = 6 N."
            },
            {
                "task": "assin2_rte",
                "category": "Semântica e Reconhecimento de Implicação Textual",
                "question": "Texto 1: O presidente assinou o decreto de preservação ambiental na Amazônia.\nTexto 2: Foi firmado um ato oficial pelo chefe do executivo para proteção de florestas.\nRelação:",
                "choices": ["Entailment (Implicação)", "None (Não Implica)"],
                "gold": "A",
                "has_negation": False,
                "explanation": "O texto 2 é parafraseado semanticamente do texto 1, caracterizando implicação mútua."
            },
            {
                "task": "tweetsentbr",
                "category": "Análise de Sentimentos em Redes Sociais",
                "question": "Classifique o sentimento do tweet: 'Não aguento mais esperar pelo suporte dessa empresa, já faz três semanas sem resposta!'",
                "choices": ["Positivo", "Neutro", "Negativo"],
                "gold": "C",
                "has_negation": True,
                "explanation": "O tweet expressa insatisfação e frustração com o atendimento, portanto tom Negativo."
            },
            {
                "task": "enem_challenge",
                "category": "Matemática e Exatas",
                "question": "Em uma progressão aritmética (PA), o primeiro termo é a1 = 7 e a razão é r = 4. Qual é o 15º termo (a15) dessa progressão?",
                "choices": ["55", "59", "63", "67", "71"],
                "gold": "C",
                "has_negation": False,
                "explanation": "Fórmula do termo geral: a_n = a1 + (n - 1)*r -> a15 = 7 + (14 * 4) = 7 + 56 = 63."
            },
            {
                "task": "enem_challenge",
                "category": "Ciências da Natureza (Física, Química, Biologia)",
                "question": "A fermentação lática ocorre nas células musculares humanas durante exercícios anaeróbicos intensos. O acúmulo temporário de qual substância está associado à fadiga muscular passageira?",
                "choices": ["Etanol", "Ácido Lático (Lactato)", "Ácido Cítrico", "Glicerol", "Glicogênio"],
                "gold": "B",
                "has_negation": False,
                "explanation": "O lactato acumula-se quando a demanda por oxigênio supera a capacidade mitocondrial na via anaeróbia."
            },
            {
                "task": "oab_exams",
                "category": "Direito Civil & Processo Civil",
                "question": "Segundo o Código Civil brasileiro, o negócio jurídico celebrado por pessoa relativamente incapaz sem a devida assistência de seu representante legal é considerado:",
                "choices": ["Nulo de pleno direito", "Anulável", "Inexistente", "Válido e eficaz imediatamente"],
                "gold": "B",
                "has_negation": False,
                "explanation": "Art. 171, I do Código Civil: é anulável o negócio jurídico por incapacidade relativa do agente."
            },
            {
                "task": "oab_exams",
                "category": "Direito Administrativo",
                "question": "O princípio da Administração Pública que exige tratamento impessoal e isonômico a todos os administrados, vedando autopromoção de agentes públicos, é o:",
                "choices": ["Princípio da Legalidade", "Princípio da Impessoalidade", "Princípio da Autotutela", "Princípio da Continuidade do Serviço"],
                "gold": "B",
                "has_negation": False,
                "explanation": "Art. 37, caput e §1º da CF/88 consagra o princípio da impessoalidade e a vedação à promoção pessoal."
            },
            {
                "task": "bluex",
                "category": "Ciências Humanas (História, Geografia, Filosofia)",
                "question": "A Batalha de Guararapes (1648-1649), ocorrida em Pernambuco, teve papel fundamental na história colonial brasileira porque culminou em:",
                "choices": [
                    "Na independência definitiva do Brasil perante Portugal",
                    "Na expulsão dos invasores holandeses e sentimento nativista",
                    "No início do ciclo do ouro em Minas Gerais",
                    "Na proclamação da República de Palmares"
                ],
                "gold": "B",
                "has_negation": False,
                "explanation": "As Batalhas dos Guararapes foram decisivas para derrotar os holandeses e marcaram as origens do Exército Brasileiro."
            },
            {
                "task": "assin2_sts",
                "category": "Similaridade Semântica e Pontuação",
                "question": "Avalie o grau de similaridade semântica entre as frases:\nFrase A: 'O estudante leu o livro na biblioteca central durante a tarde.'\nFrase B: 'No período vespertino, o aluno realizou a leitura da obra no centro bibliotecário.'",
                "choices": ["1.0 (Completamente diferente)", "2.5 (Tópico aproximado)", "4.8 (Altamente similar/quase idêntico)", "3.2 (Moderadamente similar)"],
                "gold": "C",
                "has_negation": False,
                "explanation": "As duas sentenças descrevem a mesma ação, no mesmo local e no mesmo período temporal com pequenas paráfrases."
            },
            {
                "task": "faquad_nli",
                "category": "Compreensão de Perguntas e Respostas em Português",
                "question": "Contexto: 'A Amazônia abriga a maior bacia hidrográfica do planeta, sendo o rio Amazonas responsável por cerca de 20% da vazão fluvial mundial.'\nPergunta: 'Qual porcentagem aproximada da descarga de água dos rios mundiais é atribuída ao rio Amazonas?'",
                "choices": ["5%", "10%", "20%", "50%", "75%"],
                "gold": "C",
                "has_negation": False,
                "explanation": "O texto afirma explicitamente que o rio Amazonas responde por cerca de 20% da vazão fluvial mundial."
            },
            {
                "task": "hatebr_offensive",
                "category": "Classificação de Discurso Tóxico",
                "question": "Analise o comentário de rede social sob as diretrizes de moderação:\n'Discordo completamente da opinião do colunista sobre economia, os dados apresentados carecem de fontes confiáveis.'\nClassificação:",
                "choices": ["Discurso de Ódio Ofensivo", "Crítica Legítima / Não Ofensivo"],
                "gold": "B",
                "has_negation": False,
                "explanation": "O comentário expressa discordância respeitosa sem ataques pessoais, xingamentos ou ódio."
            },
            {
                "task": "pt_hate_speech",
                "category": "Moderação de Conteúdo e Polaridade",
                "question": "Identifique se a frase a seguir NÃO viola os termos de convivência da plataforma:\nFrase: 'Excelente iniciativa da prefeitura na restauração do parque municipal.'",
                "choices": ["Viola termos (Conteúdo Impróprio)", "Não viola termos (Conteúdo Seguro)"],
                "gold": "B",
                "has_negation": True,
                "explanation": "A frase é um elogio público cívico positivo, totalmente seguro e em conformidade."
            }
        ]

        extracted_questions = []
        letters = ["A", "B", "C", "D", "E"]
        random.seed(int(time.time()))

        # Respeita rigorosamente o número de amostras solicitado pelo usuário
        total_to_generate = max(1, limit) if (limit and limit > 0) else 10

        # Mapeia questões base pelas tarefas selecionadas
        task_specific_bank = [q for q in sample_questions_bank if q["task"] in task_list]
        if not task_specific_bank:
            task_specific_bank = sample_questions_bank

        sleep_interval = max(0.015, min(0.09, 2.0 / total_to_generate))

        for idx in range(total_to_generate):
            base = task_specific_bank[idx % len(task_specific_bank)]
            task_name = task_list[idx % len(task_list)] if task_list else base["task"]

            # Variação no ID para garantir que cada questão seja única
            q_id = f"{task_name}_{idx + 1}"
            
            # Simula acurácia realista (~80% a 90% para MIMO/GPT)
            # Erra aproximadamente 1 a cada 6 ou 7 questões
            is_correct = (idx % 6 != 2)
            gold_choice = base["gold"]

            if is_correct:
                model_choice = gold_choice
            else:
                available_wrongs = [l for l in letters[:len(base["choices"])] if l != gold_choice]
                model_choice = random.choice(available_wrongs) if available_wrongs else "A"

            # Formata alternativas uniformemente
            choices_formatted = []
            for c_idx, text in enumerate(base["choices"]):
                c_letter = letters[c_idx] if c_idx < len(letters) else str(c_idx)
                choices_formatted.append({
                    "label": c_letter,
                    "text": text
                })

            # Monta pergunta
            q_text = base["question"]
            if idx >= len(task_specific_bank):
                # Variação de índice para não duplicar exatamente o mesmo texto visualmente
                q_text = f"[{task_name.upper()} Item #{idx+1}] {q_text}"

            q_obj = {
                "id": q_id,
                "index": idx,
                "task": task_name,
                "question": q_text,
                "choices": choices_formatted,
                "gold": gold_choice,
                "gold_answer": gold_choice,
                "model_choice": model_choice,
                "model_answer": model_choice,
                "is_correct": is_correct,
                "category": base["category"],
                "has_negation": base["has_negation"],
                "word_count": len(q_text.split()),
                "explanation": base["explanation"]
            }
            extracted_questions.append(q_obj)

            # Atualiza barra de progresso proporcionalmente
            with self.lock:
                self.progress_pct = 40 + int((idx + 1) / total_to_generate * 45)

            self.append_log(
                f"Processando amostra {idx+1}/{total_to_generate} [{task_name}]: "
                f"{'🟢 Acerto' if is_correct else '🔴 Erro'} (Resp: {model_choice} | Gab: {gold_choice})"
            )
            time.sleep(sleep_interval)

        with self.lock:
            self.progress_pct = 85
            self.current_task = "Calculando métricas agregadas e gerando recomendações..."

        time.sleep(0.3)
        diagnostics = analyze_diagnostics(extracted_questions)
        summary = diagnostics.get("summary", {})

        metrics = {
            "overall_accuracy": summary.get("accuracy", 0.0),
            "total_samples": summary.get("total", len(extracted_questions)),
            "tasks_evaluated": task_list
        }

        run_data = {
            "id": run_id,
            "model": model_name,
            "tasks": task_list,
            "limit": limit,
            "num_fewshot": num_fewshot,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "duration_seconds": round(time.time() - (self.start_time or time.time()), 1),
            "status": "completed",
            "is_simulation": True,
            "metrics": metrics,
            "questions": extracted_questions,
            "diagnostics": diagnostics
        }

        # Salva em JSON
        run_file = RUNS_DIR / f"{run_id}.json"
        with open(run_file, "w", encoding="utf-8") as f:
            json.dump(run_data, f, indent=2, ensure_ascii=False)

        # Salva em SQLite
        save_run_to_db(run_data)

        self.append_log(f"✅ [SIMULAÇÃO CONCLUÍDA] Resultados salvos no SQLite e em {run_file.name}")
        self.append_log(f"Acurácia Geral: {summary.get('accuracy', 0)}% ({summary.get('correct', 0)}/{summary.get('total', 0)} acertos)")

        with self.lock:
            self.progress_pct = 100
            self.current_task = "Simulação concluída com sucesso!"
            self.is_running = False

    def _execute_real(
        self,
        run_id: str,
        model_name: str,
        task_list: List[str],
        limit: Optional[int],
        num_fewshot: Optional[int],
        base_url: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        """Executa avaliação real invocando o motor lm_eval."""
        self.append_log(f"Iniciando execução real do run: {run_id}")
        self.append_log(f"Modelo: {model_name} | Tarefas: {', '.join(task_list)} | Limite de amostras: {limit}")

        try:
            # Resolução de base_url e api_key
            if not base_url:
                if "mimo" in model_name.lower():
                    base_url = os.environ.get("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1")
                elif "gpt-" in model_name.lower():
                    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
                else:
                    base_url = os.environ.get("MIMO_BASE_URL") or os.environ.get("OPENAI_BASE_URL")

            if not api_key:
                if "mimo" in model_name.lower():
                    api_key = os.environ.get("MIMO_API_KEY")
                elif "gpt-" in model_name.lower():
                    api_key = os.environ.get("OPENAI_API_KEY")
                else:
                    api_key = os.environ.get("MIMO_API_KEY") or os.environ.get("OPENAI_API_KEY")

            # Configura argumentos do modelo
            model_type = "openai-chat-completions"
            args_list = [f"model={model_name}"]
            if base_url:
                args_list.append(f"base_url={base_url}")
            if api_key:
                args_list.append(f"api_key={api_key}")
            model_args = ",".join(args_list)

            self.append_log(f"Conectando a {base_url or 'OpenAI Default'}...")

            self.append_log("Carregando motor lm_eval...")
            with self.lock:
                self.progress_pct = 15
                self.current_task = "Inicializando bibliotecas de avaliação..."

            from lm_eval import evaluator, tasks

            class LogCaptureHandler(logging.Handler):
                def __init__(self, runner_ref):
                    super().__init__()
                    self.runner_ref = runner_ref

                def emit(self, record):
                    msg = self.format(record)
                    self.runner_ref.append_log(msg)

            logger = logging.getLogger("lm-eval")
            handler = LogCaptureHandler(self)
            logger.addHandler(handler)

            self.append_log("Inicializando catálogo de tarefas...")
            tasks.initialize_tasks()

            with self.lock:
                self.progress_pct = 30
                self.current_task = f"Executando tarefas: {', '.join(task_list)}"

            self.append_log("Disparando simple_evaluate com log_samples=True...")
            results = evaluator.simple_evaluate(
                model=model_type,
                model_args=model_args,
                tasks=task_list,
                num_fewshot=num_fewshot,
                limit=limit,
                log_samples=True
            )

            with self.lock:
                self.progress_pct = 85
                self.current_task = "Processando amostras e gerando diagnósticos..."

            self.append_log("Avaliação concluída. Processando amostras para o dashboard...")
            logger.removeHandler(handler)

            samples_dict = results.get("samples", {})
            extracted_questions = []

            for task_name, samples_list in samples_dict.items():
                for idx, sample in enumerate(samples_list):
                    q = extract_question_details(sample, task_name, idx)
                    extracted_questions.append(q)

            # Análise de diagnósticos e categorias
            diagnostics = analyze_diagnostics(extracted_questions)

            # Monta objeto completo da rodada
            run_data = {
                "id": run_id,
                "model": model_name,
                "tasks": task_list,
                "limit": limit,
                "num_fewshot": num_fewshot,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "duration_seconds": round(time.time() - (self.start_time or time.time()), 1),
                "status": "completed",
                "is_simulation": False,
                "metrics": results.get("results", {}),
                "questions": extracted_questions,
                "diagnostics": diagnostics
            }

            # Salva em JSON
            run_file = RUNS_DIR / f"{run_id}.json"
            with open(run_file, "w", encoding="utf-8") as f:
                json.dump(run_data, f, indent=2, ensure_ascii=False)

            # Salva em SQLite
            save_run_to_db(run_data)

            self.append_log(f"Run salvo com sucesso em SQLite e em {run_file.name}")
            with self.lock:
                self.progress_pct = 100
                self.current_task = "Concluído com sucesso!"
                self.is_running = False

        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            self.append_log(f"ERRO durante a execução: {str(e)}")
            self.append_log(tb)
            with self.lock:
                self.error = str(e)
                self.is_running = False
                self.progress_pct = 0
                self.current_task = "Falha na execução."


runner_instance = EvaluationRunner()
