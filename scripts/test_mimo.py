import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Carrega variáveis do arquivo .env
load_dotenv()

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url=os.environ.get("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1"),
)

if __name__ == "__main__":
    completion = client.chat.completions.create(
        model="mimo-v2.6-flash",
        messages=[
            {"role": "system", "content": "Você é um assistente prestativo."},
            {"role": "user", "content": "Olá! Responda confirmando que a API Xiaomi MIMO está configurada corretamente."},
        ],
    )

    print("Resposta do modelo:")
    print(completion.choices[0].message.content)
