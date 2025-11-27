from fastapi import FastAPI
from .routes import files
app = FastAPI(title="Chat API")
@app.get("/healthz", tags=["ops"])
def healthz():
    return {"status": "ok"}
app.include_router(files.router, prefix="/files", tags=["files"])
