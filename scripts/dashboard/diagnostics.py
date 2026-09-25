"""
Módulo de Diagnóstico e Análise de Desempenho de LLMs.
Processa amostras de testes, classifica por categorias/disciplinas,
identifica padrões de erros e gera recomendações automáticas de melhorias.
"""

import re
from typing import Any, Dict, List, Optional


# Mapeamento heurístico de disciplinas por palavras-chave para ENEM / BlueX / OAB
DISCIPLINE_KEYWORDS = {
    "Matemática e Exatas": [
        "função", "triângulo", "geometria", "equação", "probabilidade", "gráfico",
        "porcentagem", "razão", "proporção", "área", "volume", "polinômio", "matriz",
        "progressão", "seno", "cosseno", "tangente", "cálculo", "fórmula"
    ],
    "Ciências da Natureza (Física, Química, Biologia)": [
        "célula", "molécula", "átomo", "reação", "velocidade", "energia", "ácido",
        "proteína", "dna", "genética", "fotossíntese", "circuito", "resistor", "onda",
        "temperatura", "pressão", "calor", "força", "gravidade", "ecossistema", "solução"
    ],
    "Ciências Humanas (História, Geografia, Filosofia)": [
        "século", "revolução", "política", "estado", "governo", "sociedade", "cidadania",
        "capitalismo", "democracia", "território", "urbanização", "migração", "filosofia",
        "sociologia", "escravidão", "constituição de 18", "república", "idade média", "cultura"
    ],
    "Linguagens e Códigos": [
        "poema", "texto", "linguagem", "autor", "narrador", "crônica", "figura de linguagem",
        "ironia", "metáfora", "gênero textual", "argumentação", "leitor", "sentido do termo",
        "coesão", "conjunção", "semântica", "vocábulo", "literatura"
    ],
    "Direito Constitucional & Teoria do Estado": [
        "constituição", "constitucional", "stf", "supremo tribunal", "emenda constitucional",
        "direitos fundamentais", "pacto federativo", "competência privativa", "adpf", "adi"
    ],
    "Direito Penal & Processo Penal": [
        "crime", "pena", "delito", "código penal", "homicídio", "dolo", "culpa", "furto",
        "roubo", "prisão", "inquérito", "liberdade provisória", "habeas corpus", "tipicidade"
    ],
    "Direito Civil & Processo Civil": [
        "contrato", "código civil", "obrigação", "indenização", "propriedade", "posse",
        "sucessão", "herança", "casamento", "divórcio", "petição inicial", "recurso de apelação",
        "consumidor", "responsabilidade civil"
    ],
    "Direito Administrativo": [
        "administração pública", "licitação", "servidor público", "ato administrativo",
        "concessão", "desapropriação", "improbidade administrativa", "órgão público"
    ],
    "Ética Profissional OAB": [
        "estatuto da advocacia", "código de ética", "honorários", "incompatibilidade",
        "impedimento", "sigilo profissional", "inscrição na oab", "sociedade de advogados"
    ]
}


def infer_subject(doc: Dict[str, Any], question_text: str) -> str:
    """Infere ou obtém a disciplina/categoria da questão."""
    # 1. Verifica se já existe metadado explícito no dataset
    for field in ["discipline", "subject", "area", "materia", "category", "topic"]:
        val = doc.get(field)
        if val and isinstance(val, str) and val.strip():
            return val.strip().title()

    # 2. Heurística textual baseada nas palavras-chave do enunciado
    text_lower = (question_text or "").lower()
    scores = {}
    for disc, keywords in DISCIPLINE_KEYWORDS.items():
        score = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", text_lower))
        if score > 0:
            scores[disc] = score

    if scores:
        best_disc = max(scores.items(), key=lambda x: x[1])[0]
        return best_disc

    return "Geral / Multidisciplinar"


def extract_question_details(sample: Dict[str, Any], task_name: str, index: int) -> Dict[str, Any]:
    """Extrai informações uniformizadas de uma questão individual."""
    doc = sample.get("doc", {})
    arguments = sample.get("arguments", [])
    resps = sample.get("resps", [])
    filtered_resps = sample.get("filtered_resps", [])
    target = sample.get("target", "")

    # Identificador
    qid = str(doc.get("id") or doc.get("exam_id") or f"{task_name}_{index}")

    # Enunciado
    question = doc.get("question") or doc.get("text") or doc.get("prompt") or ""
    if not question and arguments and len(arguments) > 0:
        first_arg = arguments[0]
        if isinstance(first_arg, (list, tuple)) and len(first_arg) > 0:
            question = str(first_arg[0])
        elif isinstance(first_arg, str):
            question = first_arg

    # Alternativas (se existirem)
    choices_raw = doc.get("choices")
    choices = []
    if isinstance(choices_raw, dict) and "label" in choices_raw and "text" in choices_raw:
        for lbl, txt in zip(choices_raw["label"], choices_raw["text"]):
            choices.append({"label": str(lbl).strip(), "text": str(txt).strip()})
    elif isinstance(choices_raw, list):
        for idx, item in enumerate(choices_raw):
            if isinstance(item, dict):
                lbl = item.get("label") or chr(ord("A") + idx)
                txt = item.get("text") or ""
                choices.append({"label": str(lbl).strip(), "text": str(txt).strip()})
            else:
                lbl = chr(ord("A") + idx)
                choices.append({"label": lbl, "text": str(item).strip()})

    # Resposta predita pelo modelo
    model_answer = ""
    if filtered_resps and len(filtered_resps) > 0:
        model_answer = str(filtered_resps[0]).strip()
    elif resps and len(resps) > 0:
        resp_item = resps[0]
        if isinstance(resp_item, (list, tuple)) and len(resp_item) > 0:
            model_answer = str(resp_item[0]).strip()
        else:
            model_answer = str(resp_item).strip()

    # Gabarito esperado
    gold_answer = str(target or doc.get("answerKey") or doc.get("label") or "").strip()

    # Métrica de acerto
    is_correct = False
    if "acc" in sample:
        is_correct = bool(sample["acc"] == 1.0 or sample["acc"] is True)
    elif "acc_norm" in sample:
        is_correct = bool(sample["acc_norm"] == 1.0 or sample["acc_norm"] is True)
    else:
        # Comparação normalizada
        is_correct = (model_answer.upper() == gold_answer.upper()) and bool(gold_answer)

    # Identificação da Categoria/Disciplina
    subject = infer_subject(doc, question)

    # Detecção de armadilhas de negação no enunciado
    has_negation = bool(re.search(r"\b(não|incorret[ao]|exceto|fals[ao]|errad[ao]|inadequad[ao])\b", question.lower()))

    # Tamanho do enunciado
    word_count = len(question.split())

    return {
        "id": qid,
        "index": index,
        "task": task_name,
        "question": question,
        "choices": choices,
        "model_answer": model_answer,
        "gold_answer": gold_answer,
        "is_correct": is_correct,
        "category": subject,
        "has_negation": has_negation,
        "word_count": word_count,
        "exam_year": str(doc.get("year") or doc.get("exam") or ""),
    }


def analyze_diagnostics(questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Gera agregação de categorias, estatísticas e sugestões automáticas de melhorias."""
    total = len(questions)
    if total == 0:
        return {
            "summary": {"total": 0, "correct": 0, "wrong": 0, "accuracy": 0.0},
            "categories": [],
            "suggestions": []
        }

    correct_count = sum(1 for q in questions if q["is_correct"])
    wrong_count = total - correct_count
    accuracy = (correct_count / total) * 100.0

    # Agrupamento por Categoria
    cat_stats = {}
    for q in questions:
        cat = q["category"]
        if cat not in cat_stats:
            cat_stats[cat] = {"category": cat, "total": 0, "correct": 0, "wrong": 0}
        cat_stats[cat]["total"] += 1
        if q["is_correct"]:
            cat_stats[cat]["correct"] += 1
        else:
            cat_stats[cat]["wrong"] += 1

    categories_list = []
    for cat, stats in cat_stats.items():
        stats["accuracy"] = round((stats["correct"] / stats["total"]) * 100.0, 1)
        categories_list.append(stats)

    # Ordena por menor acurácia (onde o modelo tem mais dificuldade)
    categories_list.sort(key=lambda x: (x["accuracy"], -x["total"]))

    # Análise de padrões de erro para Sugestões Automáticas
    suggestions = []

    # 1. Análise de Negações ("NÃO", "INCORRETO", "EXCETO")
    negation_questions = [q for q in questions if q["has_negation"]]
    if negation_questions:
        neg_total = len(negation_questions)
        neg_correct = sum(1 for q in negation_questions if q["is_correct"])
        neg_acc = (neg_correct / neg_total) * 100.0
        if neg_acc < accuracy - 10.0 or neg_acc < 60.0:
            suggestions.append({
                "type": "prompt_engineering",
                "severity": "high" if neg_acc < 50 else "medium",
                "title": "Atenção a Enunciados com Negação (INCORRETO / EXCETO)",
                "description": f"A LLM acertou apenas {neg_acc:.1f}% das questões contendo termos como 'NÃO', 'EXCETO' ou 'INCORRETO' (contra {accuracy:.1f}% na média geral). Modelos frequentemente sofrem com viés de confirmação selecionando a primeira alternativa verdadeira.",
                "recommendation": "Inclua no prompt do sistema uma instrução enfática: 'Preste atenção estrita a palavras de negação como INCORRETO, EXCETO ou NÃO no enunciado antes de selecionar a alternativa'."
            })

    # 2. Análise de Enunciados Longos
    long_questions = [q for q in questions if q["word_count"] > 180]
    if long_questions:
        long_total = len(long_questions)
        long_correct = sum(1 for q in long_questions if q["is_correct"])
        long_acc = (long_correct / long_total) * 100.0
        if long_acc < accuracy - 8.0:
            suggestions.append({
                "type": "few_shot_prompt",
                "severity": "medium",
                "title": "Degradação em Textos Longos e Crônicas",
                "description": f"Acurácia caiu para {long_acc:.1f}% em enunciados com mais de 180 palavras. A LLM tende a perder o foco nas premissas finais em textos longos.",
                "recommendation": "Adicione exemplos few-shot que demonstrem a síntese preliminar do texto base antes de avaliar cada alternativa."
            })

    # 3. Categorias com pior desempenho
    weak_categories = [c for c in categories_list if c["accuracy"] < 70.0 and c["total"] >= 2]
    if weak_categories:
        worst = weak_categories[0]
        suggestions.append({
            "type": "fine_tuning_rag",
            "severity": "high",
            "title": f"Dificuldade Crítica em: {worst['category']}",
            "description": f"O modelo apresentou apenas {worst['accuracy']}% de acerto nesta área ({worst['wrong']} erros de {worst['total']} questões).",
            "recommendation": f"Recomenda-se integrar RAG (Retrieval-Augmented Generation) com base de conhecimento especializada em {worst['category']} ou realizar fine-tuning direcionado (LoRA/SFT) com bancos de questões dessa matéria."
        })

    # 4. Sugestão geral de Chain-of-Thought (CoT)
    if accuracy < 90.0:
        suggestions.append({
            "type": "reasoning_cot",
            "severity": "low",
            "title": "Adoção de Raciocínio Passo a Passo (Chain-of-Thought)",
            "description": "Atualmente o modelo responde diretamente a letra da alternativa. Para problemas que exigem dedução em múltiplos passos, o raciocínio explícito reduz erros dedutivos.",
            "recommendation": "Altere o formato de resposta para solicitar uma breve justificativa em 2 linhas antes de indicar a letra final no formato 'Resposta: [LETRA]'."
        })

    return {
        "summary": {
            "total": total,
            "correct": correct_count,
            "wrong": wrong_count,
            "accuracy": round(accuracy, 2)
        },
        "categories": categories_list,
        "suggestions": suggestions
    }
