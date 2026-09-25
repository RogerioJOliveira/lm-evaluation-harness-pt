# Language Model Evaluation Harness para LLMs em Português

**Um framework para avaliação de Modelos de Linguagem de Larga Escala (LLMs) em Português**

Este repositório é um fork do [LM Evaluation Harness da EleutherAI](https://github.com/EleutherAI/lm-evaluation-harness), adaptado especificamente para a avaliação de modelos de linguagem na língua portuguesa. 📐 Ele serve como a suíte de avaliação oficial do 🚀 [Open Portuguese LLM Leaderboard](https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard), cujo objetivo é rastrear, classificar e avaliar LLMs abertos e chatbots focados no idioma português.

Envie um modelo para avaliação automatizada no cluster de GPUs do Hugging Face através da página de ["Submissão"](https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard?tab=submit) no leaderboard!

> 📘 **Guia Completo em Português**: Consulte o [**GUIA_DE_USO.md**](GUIA_DE_USO.md) para instruções detalhadas de instalação, configuração do `.env`, uso com APIs (incluindo Xiaomi MIMO) e execução dos testes.

---

## Sobre o Leaderboard

O 🚀 **Open Portuguese LLM Leaderboard** visa fornecer um benchmark abrangente para avaliar Modelos de Linguagem de Larga Escala (LLMs) em português através de uma variedade de tarefas e conjuntos de dados. O leaderboard:

- É aberto a submissões da comunidade;
- Serve como recurso para pesquisadores, profissionais e entusiastas;
- Inclui tarefas cobrindo múltiplos aspectos de compreensão e geração de linguagem natural.

Este leaderboard é viabilizado com o apoio do [Centro de Excelência em Inteligência Artificial (CEIA)](https://ceia.ufg.br/) da [Universidade Federal de Goiás (UFG)](https://international.ufg.br/).

---

## Recursos Específicos para Português

Este fork inclui diversas modificações customizadas para a avaliação em língua portuguesa:

- **Suíte de Tarefas em Português**: Uma coleção de tarefas de PLN desenvolvidas para a língua portuguesa (veja a lista abaixo).
- **Avaliação de Respostas Diretas**: Funciona com respostas em texto direto geradas pelos modelos, em vez de apenas probabilidades de log (*logprobs*), ideal para avaliar modelos instruídos (*instruction-tuned*) e chatbots.
- **Suporte a Chat Templates**: Compatibilidade integrada com LLMs que utilizam diferentes modelos de conversa (*chat templates*) da biblioteca `transformers`. Detecta e aplica automaticamente o formato adequado (`system-user-assistant`, `user-assistant` ou `assistant-user`) sem necessidade de configuração manual. Isso garante uma avaliação precisa de modelos otimizados para diálogo em seus formatos de prompt nativos.
- **Suporte a Múltiplos Backends**: 
  - **Integração com vLLM**: Inferência acelerada com avaliação em lote para processamento mais rápido de modelos grandes.
  - **Suporte a APIs (OpenAI / Xiaomi MIMO / LiteLLM)**: Avaliação de modelos proprietários e remotos via API.
- **Otimização de Memória**: 
  - Detecção e ajuste automático do tamanho do lote (*batch size*) com base na memória de GPU disponível.
  - Ajuste dinâmico de `max_length` para uso eficiente dos recursos.
  - Opção `starting_max_length` para melhor gerenciamento de memória na GPU.
- **Melhorias de Avaliação**:
  - Novas métricas calculadas (F1-Macro, Pearson) alinhadas aos benchmarks originais das tarefas selecionadas.
  - Extração de raciocínio (*reasoning*) para modelos que fornecem explicações antes da resposta (ex.: modelos DeepSeek).
  - Controle de temperatura (fixado em 0) para modelos de API garantindo saídas determinísticas.
- **Filtros Customizados**: Pipelines de processamento de texto adaptados às características específicas das tarefas em português.
- **Suporte a UTF-8**: Codificação adequada para textos em português com acentuação e caracteres especiais tanto na entrada quanto na saída.
- **Amostragem de IDs Few-shot**: Preserva a ordem dos exemplos *few-shot* para consistência nas avaliações.
- **Melhor Integração com a API do Hugging Face Datasets**.

---

## Tarefas de Avaliação em Português

A suíte inclui um conjunto diversificado de tarefas cobrindo diferentes capacidades. As avaliações utilizam primariamente exemplos no contexto (*few-shot*, tipicamente de 3 a 25 dependendo da tarefa) para avaliar a performance do modelo.

| Alias da Tarefa | Descrição | Few-shot | Métrica Principal | Linha de Base (Baseline) | Link / Fonte |
|:---|:---|:---:|:---:|:---:|:---|
| **`assin2_rte`** | Reconhecimento de Implicação Textual (ASSIN 2) | 15 | F1 Macro | 50.0 | [ASSIN 2](https://sites.google.com/view/assin2/) |
| **`assin2_sts`** | Similaridade Textual Semântica (ASSIN 2) | 15 | Pearson | 0.0 | [ASSIN 2](https://sites.google.com/view/assin2/) |
| **`bluex`** | Interpretação de Texto e Vestibulares (BlueX) | 5 | F1 Macro | 33.3 | [BlueX Dataset](https://github.com/portuguese-benchmark-datasets/bluex) |
| **`enem`** | Questões de Múltipla Escolha (Exame ENEM) | 3 | Acurácia | 20.0 | [ENEM Challenge](https://www.ime.usp.br/~ddm/project/enem/) |
| **`faquad_nli`** | Inferência em Linguagem Natural (FaQuAD-NLI) | 5 | F1 Macro | 33.3 | [FaQuAD-NLI](https://huggingface.co/datasets/ruanchaves/faquad-nli) |
| **`hatebr`** | Detecção de Linguagem Ofensiva (HateBR) | 25 | F1 Macro | 50.0 | [HateBR Dataset](https://github.com/franciellevargas/HateBR) |
| **`hate_speech`** | Identificação de Discurso de Ódio (Portuguese Hate Speech) | 25 | F1 Macro | 47.9 | [Portuguese Hate Speech](https://github.com/paulafortuna/Portuguese-Hate-Speech-Dataset) |
| **`tweetsentbr`** | Análise de Sentimento (TweetSentBR) | 25 | F1 Macro | 32.8 | [TweetSentBR](https://bitbucket.org/HBrum/tweetsentbr) |
| **`oab_exams`** | Questões do Exame de Ordem dos Advogados (OAB) | 3 | Acurácia | 20.0 | [OAB Exams](https://github.com/legal-nlp/oab-exams) |

### Descrição detalhada das tarefas:

- **`assin2_rte`**: Conjunto de dados para Reconhecimento de Implicação Textual em português, parte da tarefa compartilhada do ASSIN 2.
- **`assin2_sts`**: Conjunto de dados para Similaridade Textual Semântica em português, avaliando a capacidade do modelo de mensurar equivalência de sentido entre frases.
- **`bluex`**: Dataset de interpretação de texto e vestibulares brasileiros (USP, Unicamp), testando a capacidade de compreensão e extração de informações complexas.
- **`enem`**: Questões do Exame Nacional do Ensino Médio (ENEM), cobrindo diversas áreas do conhecimento em formato de múltipla escolha.
- **`faquad_nli`**: Dataset de inferência derivado do conjunto de perguntas e respostas FaQuAD.
- **`hatebr`**: Comentários de usuários do Instagram brasileiro anotados por especialistas para detecção de linguagem ofensiva e discurso de ódio.
- **`hate_speech`**: Dataset rotulado hierarquicamente composto por tweets em português com anotações binárias sobre discurso de ódio.
- **`tweetsentbr`**: Corpus de tweets em português brasileiro anotados para análise de sentimentos em três classes (Positivo, Negativo, Neutro).
- **`oab_exams`**: Questões de múltipla escolha dos Exames de Ordem da OAB, avaliando conhecimento jurídico e interpretação legal.

*Nota: As pontuações de linha de base (baseline) representam a expectativa de desempenho padrão (ex.: escolha aleatória em tarefas de classificação). O número de exemplos few-shot pode variar ligeiramente de acordo com a configuração.*

Os prompts e exemplos few-shot utilizados por cada tarefa podem ser consultados nos arquivos de configuração YAML em [`lm_eval/tasks/portuguese`](lm_eval/tasks/portuguese).

---

## Primeiros Passos

### Instalação

```bash
git clone https://github.com/eduagarcia/lm-evaluation-harness-pt
cd lm-evaluation-harness-pt
pip install -e .

# Para funcionalidades estendidas (APIs como OpenAI e MIMO, vLLM, etc.)
pip install -e ".[vllm,anthropic,openai,sentencepiece]"
```

---

### Uso Básico

Para avaliar um LLM em português com todo o benchmark do Open PT LLM Leaderboard:

```bash
lm_eval \
    --model huggingface \
    --model_args "pretrained=SEU_MODELO_ID,revision=main" \
    --tasks enem_challenge,bluex,oab_exams,assin2_rte,assin2_sts,faquad_nli,hatebr_offensive,portuguese_hate_speech,tweetsentbr \
    --device cuda:0 \
    --output_path "./"
```

Você também pode avaliar tarefas individuais:

```bash
# Para modelos base
lm_eval --model hf \
    --model_args pretrained=SEU_MODELO_ID,trust_remote_code=True \
    --tasks assin2_rte,tweetsentbr \
    --device cuda:0 \
    --batch_size auto \
    --output_path results/SEU_MODELO_ID
```

#### Templates de Chat (Chat Template)
A biblioteca detecta e aplica automaticamente os chat templates existentes na configuração do tokenizer do modelo. Se você precisar desativar essa detecção:

```bash
# Testa formatos de chat (system-user-assistant, user-assistant, etc.)
# e usa o compatível com o modelo.
# Para desativar a aplicação do template:
lm_eval --model hf \
    --model_args pretrained=SEU_MODELO_ID,trust_remote_code=True,apply_chat_template=False \
    --tasks assin2_rte,tweetsentbr \
    --device cuda:0 \
    --batch_size auto \
    --output_path results/SEU_MODELO_ID
```

*Defina `batch_size` como `auto` para detecção automática do tamanho de lote suportado ou especifique um número inteiro.*

---

### Otimização de Memória

Escolha a técnica que melhor se adapta às restrições do seu hardware:

#### 1. Tamanho de Lote Automático (Auto Batch Size)
```bash
# Detecta automaticamente o maior batch size suportado pela sua GPU
lm_eval --model hf \
    --model_args pretrained=SEU_MODELO_ID \
    --tasks enem_challenge,bluex,oab_exams,assin2_rte,assin2_sts,faquad_nli,hatebr_offensive,portuguese_hate_speech,tweetsentbr \
    --device cuda:0 \
    --batch_size auto \
    --output_path results/SEU_MODELO_ID
```

#### 2. Comprimento Máximo Inicial (Starting Max Length)
```bash
lm_eval --model hf \
    --model_args pretrained=SEU_MODELO_ID,starting_max_length=1024 \
    --tasks enem_challenge,bluex,oab_exams,assin2_rte,assin2_sts,faquad_nli,hatebr_offensive,portuguese_hate_speech,tweetsentbr \
    --device cuda:0 \
    --batch_size auto \
    --output_path results/SEU_MODELO_ID
```

#### 3. Quantização em 4-bit
```bash
lm_eval --model hf \
    --model_args pretrained=SEU_MODELO_ID,load_in_4bit=True \
    --tasks enem_challenge,bluex,oab_exams,assin2_rte,assin2_sts,faquad_nli,hatebr_offensive,portuguese_hate_speech,tweetsentbr \
    --device cuda:0 \
    --batch_size auto \
    --output_path results/SEU_MODELO_ID
```

---

### Utilizando Modelos via API

#### Avaliação com OpenAI:
```bash
export OPENAI_API_KEY=SUA_CHAVE_AQUI
lm_eval --model openai-chat-completions \
    --model_args model=gpt-4-turbo \
    --tasks enem_challenge,bluex,oab_exams,assin2_rte,assin2_sts,faquad_nli,hatebr_offensive,portuguese_hate_speech,tweetsentbr \
    --output_path results/gpt-4-turbo
```

#### Avaliação com Xiaomi MIMO (`mimo-v2.6-flash`):
Você pode configurar as chaves no arquivo `.env` ou passá-las diretamente:
```bash
py -3.12 -m lm_eval --model openai-chat-completions \
    --model_args model=mimo-v2.6-flash,base_url=https://api.xiaomimimo.com/v1 \
    --tasks enem_challenge \
    --limit 10
```

---

## Submissão Manual ao Leaderboard

O [Open Portuguese LLM Leaderboard](https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard) oferece dois métodos para envio de modelos:

1. **Submissão Automática**: Envie seu modelo através da página de ["Submissão"](https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard?tab=submit) no leaderboard para avaliação em um cluster de GPU disponível. Esta é a opção recomendada e mais simples para a maioria dos modelos.
2. **Submissão Manual**: Para modelos com requisitos especiais (como necessidade de `trust_remote_code=True`, dependência de bibliotecas além de `transformers`, modelos sem pesos públicos ou falhas na submissão automática).

Para submissão manual, siga as instruções abaixo:

### 1. Execute a Avaliação Completa
```bash
lm_eval --model hf \
       --model_args pretrained=SEU_MODELO_ID,trust_remote_code=True \
       --tasks enem_challenge,bluex,oab_exams,assin2_rte,assin2_sts,faquad_nli,hatebr_offensive,portuguese_hate_speech,tweetsentbr \
       --device cuda:0 \
       --batch_size auto \
       --output_path results/SEU_MODELO_ID \
       --log_samples
```

### 2. Envie os Resultados
Após a conclusão:
1. Localize os arquivos JSON de resultados no diretório de saída (`output_path`);
2. [Abra uma discussão](https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard/discussions/new) no espaço do leaderboard anexando os resultados;
3. **Envie um e-mail** para `edusantosgarcia@gmail.com` com:
   - O nome do modelo e o link no Hugging Face Hub;
   - Os arquivos JSON compactados em zip anexados;
   - Quaisquer considerações especiais sobre o modelo.

Os resultados serão revisados e adicionados manualmente ao ranking.

---

## Resolução de Problemas em Avaliações

Se a avaliação do seu modelo falhar:
1. **Teste Local com Amostra**: Execute o comando localmente adicionando `--limit 10` para testar rapidamente uma quantidade reduzida de exemplos por tarefa:
   ```bash
   lm_eval --model hf \
       --model_args pretrained=SEU_MODELO_ID,trust_remote_code=True \
       --tasks enem_challenge \
       --device cuda:0 \
       --batch_size 8 \
       --limit 10
   ```
2. **Verifique os Logs**: Examine o arquivo `output.log` ou o terminal para verificar a mensagem exata do erro.
3. **Consulte a FAQ do Leaderboard**: Revise a seção de dúvidas frequentes no [espaço do leaderboard](https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard).
4. **Abra uma Issue**: Se o problema persistir, abra uma issue neste repositório ou no fórum de discussões do leaderboard.

---

## Agradecimentos

Este projeto é construído sobre o excelente trabalho do [LM Evaluation Harness da EleutherAI](https://github.com/EleutherAI/lm-evaluation-harness). Expressamos nossa gratidão aos autores e contribuidores originais. Também agradecemos aos criadores dos conjuntos de dados utilizados nas tarefas do benchmark em português.

---

## Citação

Se você utilizar este framework ou os resultados deste benchmark em sua pesquisa, por favor cite este repositório e o LM Evaluation Harness original:

```bibtex
@misc{open-pt-llm-leaderboard,
  author = {Garcia, Eduardo A. S.},
  title = {Open Portuguese LLM Leaderboard},
  year = {2024},
  publisher = {Hugging Face},
  howpublished = "\url{https://huggingface.co/spaces/eduagarcia/open_pt_llm_leaderboard}"
}

@misc{eval-harness,
  author       = {Gao, Leo and Tow, Jonathan and Abbasi, Baber and Biderman, Stella and Black, Sid and DiPofi, Anthony and Foster, Charles and Golding, Laurence and Hsu, Jeffrey and Le Noac'h, Alain and Li, Haonan and McDonell, Kyle and Muennighoff, Niklas and Ociepa, Chris and Phang, Jason and Reynolds, Laria and Schoelkopf, Hailey and Skowron, Aviya and Sutawika, Lintang and Tang, Eric and Thite, Anish and Wang, Ben and Wang, Kevin and Zou, Andy},
  title        = {A framework for few-shot language model evaluation},
  month        = 12,
  year         = {2023},
  publisher    = {Zenodo},
  version      = {v0.4.0},
  doi          = {10.5281/zenodo.10256836},
  url          = {https://zenodo.org/records/10256836}
}
```

Para citar os datasets específicos do benchmark em português:

```bibtex
@InProceedings{ENEM-Challenge,
  author = {Silveira, Igor Cataneo and Mau\'a, Denis Deratani},
  booktitle = {Proceedings of the 6th Brazilian Conference on Intelligent Systems},
  series = {BRACIS},
  title = {University Entrance Exam as a Guiding Test for Artificial Intelligence},
  pages = {426--431},
  year = {2017}
}

@misc{nunes2023evaluating,
  title={Evaluating GPT-3.5 and GPT-4 Models on Brazilian University Admission Exams}, 
  author={Desnes Nunes and Ricardo Primi and Ramon Pires and Roberto Lotufo and Rodrigo Nogueira},
  year={2023},
  eprint={2303.17003},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}

@misc{pires2023evaluating,
  title={Evaluating GPT-4's Vision Capabilities on Brazilian University Admission Exams}, 
  author={Ramon Pires and Thales Sales Almeida and Hugo Abonizio and Rodrigo Nogueira},
  year={2023},
  eprint={2311.14169},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}

@misc{almeida2023bluex,
  title={BLUEX: A benchmark based on Brazilian Leading Universities Entrance eXams}, 
  author={Thales Sales Almeida and Thiago Laitz and Giovana K. Bonás and Rodrigo Nogueira},
  year={2023},
  eprint={2307.05410},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}

@inproceedings{d2017passing,
  title={Passing the Brazilian OAB Exam: Data Preparation and Some Experiments1},
  author={d RADEMAKER, Alexandre},
  booktitle={Legal Knowledge and Information Systems: JURIX 2017: The Thirtieth Annual Conference},
  volume={302},
  pages={89},
  year={2017},
  organization={IOS Press}
}

@inproceedings{real2020assin,
  title={The assin 2 shared task: a quick overview},
  author={Real, Livy and Fonseca, Erick and Oliveira, Hugo Goncalo},
  booktitle={International Conference on Computational Processing of the Portuguese Language},
  pages={406--412},
  year={2020},
  organization={Springer}
}

@inproceedings{8923668,
  author={Sayama, Hélio Fonseca and Araujo, Anderson Viçoso and Fernandes, Eraldo Rezende},
  booktitle={2019 8th Brazilian Conference on Intelligent Systems (BRACIS)}, 
  title={FaQuAD: Reading Comprehension Dataset in the Domain of Brazilian Higher Education}, 
  year={2019},
  volume={},
  number={},
  pages={443-448},
  keywords={Training;Context modeling;Encyclopedias;Electronic publishing;Internet;Natural Language Processing;Machine Reading Comprehension;Dataset},
  doi={10.1109/BRACIS.2019.00084}
}

@software{Chaves_Rodrigues_napolab_2023,
  author = {Chaves Rodrigues, Ruan and Tanti, Marc and Agerri, Rodrigo},
  doi = {10.5281/zenodo.7781848},
  month = {3},
  title = {{Natural Portuguese Language Benchmark (Napolab)}},
  url = {https://github.com/ruanchaves/napolab},
  version = {1.0.0},
  year = {2023}
}

@inproceedings{vargas-etal-2022-hatebr,
  title = "{H}ate{BR}: A Large Expert Annotated Corpus of {B}razilian {I}nstagram Comments for Offensive Language and Hate Speech Detection",
  author = "Vargas, Francielle  and
    Carvalho, Isabelle  and
    Rodrigues de G{\'o}es, Fabiana  and
    Pardo, Thiago  and
    Benevenuto, Fabr{\'\i}cio",
  booktitle = "Proceedings of the Thirteenth Language Resources and Evaluation Conference",
  month = jun,
  year = "2022",
  address = "Marseille, France",
  publisher = "European Language Resources Association",
  url = "https://aclanthology.org/2022.lrec-1.777",
  pages = "7174--7183"
}

@inproceedings{fortuna-etal-2019-hierarchically,
  title = "A Hierarchically-Labeled {P}ortuguese Hate Speech Dataset",
  author = "Fortuna, Paula  and
    Rocha da Silva, Jo{\~a}o  and
    Soler-Company, Juan  and
    Wanner, Leo  and
    Nunes, S{\'e}rgio",
  booktitle = "Proceedings of the 3rd Workshop on Abusive Language Online (ALW3)",
  year = "2019",
  publisher = "Association for Computational Linguistics",
  url = "https://aclanthology.org/W19-3510",
  doi = "10.18653/v1/W19-3510",
  pages = "94--104",
}

@InProceedings{BRUM18.389,
  author = {Henrico Brum and Maria das Gra\c{c}as Volpe Nunes},
  title = "{Building a Sentiment Corpus of Tweets in Brazilian Portuguese}",
  booktitle = {Proceedings of the Eleventh International Conference on Language Resources and Evaluation (LREC 2018)},
  year = {2018},
  month = {May 7-12, 2018},
  address = {Miyazaki, Japan},
  editor = {Nicoletta Calzolari (Conference chair) and Khalid Choukri and Christopher Cieri and Thierry Declerck and Sara Goggi and Koiti Hasida and Hitoshi Isahara and Bente Maegaard and Joseph Mariani and HÚlŔne Mazo and Asuncion Moreno and Jan Odijk and Stelios Piperidis and Takenobu Tokunaga},
  publisher = {European Language Resources Association (ELRA)},
  isbn = {979-10-95546-00-9},
  language = {english}
}
```
