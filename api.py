from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Field, SQLModel, Session, create_engine, select
from sqlalchemy import text
from typing import List, Optional
import tempfile
from pathlib import Path
from dotenv import load_dotenv
import json

load_dotenv()
from agents.polizza_agent import PolizzaExtractor

class PolizzaRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nome_file: str
    compagnia: str
    numero_polizza: str
    premio_totale: str
    tipo_polizza: str
    soggetti_json: str

sqlite_url = "sqlite:///database.db"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

app = FastAPI()

# Permette a qualsiasi sito frontend di comunicare con questo backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

extractor = PolizzaExtractor()

@app.get("/api/storia")
async def get_storia():
    with Session(engine) as session:
        records = session.exec(select(PolizzaRecord).order_by(PolizzaRecord.id.desc())).all()
        risultato = []
        for r in records:
            d = r.dict()
            d['soggetti_coinvolti'] = json.loads(r.soggetti_json)
            risultato.append(d)
        return risultato

@app.post("/api/estrai-polizza")
async def analizza_documento(file: UploadFile = File(...)):
    contenuto = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contenuto)
        tmp_path = tmp.name
    try:
        testo = extractor.extract_text_from_pdf(tmp_path)
        risultato = extractor.analyze_policy(testo)
        with Session(engine) as session:
            nuovo_record = PolizzaRecord(
                nome_file=file.filename,
                compagnia=risultato.get("compagnia", "N/D"),
                numero_polizza=risultato.get("numero_polizza", "N/D"),
                premio_totale=risultato.get("premio_totale", "€ 0,00"),
                tipo_polizza=risultato.get("tipo_polizza", "N/D"),
                soggetti_json=json.dumps(risultato.get("soggetti_coinvolti", []))
            )
            session.add(nuovo_record)
            session.commit()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        Path(tmp_path).unlink(missing_ok=True)

@app.delete("/api/pulisci-tutto")
async def pulisci_tutto():
    with Session(engine) as session:
        session.exec(text("DELETE FROM polizzarecord"))
        session.commit()
    return {"status": "success"}
