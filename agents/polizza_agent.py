import fitz  # PyMuPDF
import os
import json
from groq import Groq
from pydantic import BaseModel, Field
from typing import List, Optional

# --- 1. SCHEMA DEI DATI (Il contratto tra noi e l'AI) ---
class Persona(BaseModel):
    nome_cognome: str = Field(description="Nome e cognome o ragione sociale")
    ruolo: str = Field(description="Contraente, Assicurato, Beneficiario, ecc.")
    codice_fiscale: str = Field(default="N/D")

class StrutturaPolizza(BaseModel):
    compagnia: str = Field(default="N/D")
    tipo_polizza: str = Field(default="N/D")
    numero_polizza: str = Field(default="N/D")
    soggetti_coinvolti: List[Persona] = Field(default_factory=list)
    data_scadenza: str = Field(default="N/D")
    premio_totale: str = Field(default="€ 0,00")

# --- 2. CLASSE ESTRATTORE ---
class PolizzaExtractor:
    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("Manca la chiave GROQ_API_KEY nel file .env")

        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        testo = ""
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                testo += page.get_text() + "\n"
            doc.close()
            return testo.strip()
        except Exception as e:
            print(f"❌ Errore PDF: {e}")
            return ""

    def analyze_policy(self, testo_grezzo: str) -> dict:
        # Prompt ultra-stretto per evitare che l'AI "inventi" nomi di chiavi
        prompt_sistema = """
        Sei un estrattore di dati assicurativi infallibile.
        Analizza il testo e restituisci SOLO un oggetto JSON con queste chiavi esatte:
        - compagnia (stringa)
        - numero_polizza (stringa)
        - premio_totale (stringa con valuta)
        - soggetti_coinvolti (lista di oggetti con nome_cognome e ruolo)
        - tipo_polizza (stringa)

        NON aggiungere commenti, NON creare liste annidate come 'polizze' o 'dati'.
        """

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": f"Testo polizza:\n{testo_grezzo}"}
                ],
                response_format={"type": "json_object"},
            )

            res_content = completion.choices[0].message.content
            return json.loads(res_content)

        except Exception as e:
            print(f"🚨 ERRORE AI: {e}")
            return {"error": str(e)}
