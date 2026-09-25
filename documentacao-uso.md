# Plano: Documentação de Uso da Aplicação (lm-evaluation-harness-pt)

## Objetivo
Criar uma documentação clara, completa e em Português ensinando como instalar, configurar variáveis de ambiente (.env), executar scripts diretos de inferência (como Xiaomi MIMO via cliente OpenAI) e rodar benchmarks de avaliação em tarefas em português via CLI.

## Tarefas
- [x] Tarefa 1: Criar `GUIA_DE_USO.md` na raiz com seções de Instalação, Configuração do `.env`, Execução com `scripts/test_mimo.py`, CLI `lm-eval`, Tabela de Tarefas e Solução de Problemas. → Verificar: arquivo existe e cobre todos os fluxos.
- [x] Tarefa 2: Atualizar o `README.md` incluindo chamada em destaque para o novo guia em Português e suporte a modelos de API (OpenAI/MIMO). → Verificar: links funcionais no README.
- [x] Tarefa 3: Validar a execução dos exemplos documentados em ambiente local (Python no Windows). → Verificar: comandos sem erros de sintaxe ou codificação.

## Critérios de Sucesso
- [x] O usuário consegue clonar, configurar o `.env` com sua chave da Xiaomi MIMO e rodar um teste em menos de 5 minutos.
- [x] Todos os comandos para CLI e scripts Python estão documentados com exemplos reais.

## Notas
- O `.env` e chaves sensíveis permanecem protegidos pelo `.gitignore`.

## ✅ FASE X CONCLUÍDA
- Documentação Principal: [`GUIA_DE_USO.md`](GUIA_DE_USO.md) criado com sucesso.
- Integração README: [`README.md`](README.md) atualizado com atalho para a documentação em português.
- Teste Funcional: Script de teste executado com retorno validado da API Xiaomi MIMO.
