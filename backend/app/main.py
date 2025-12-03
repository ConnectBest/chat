from fastapi import FastAPI
from .db import db

app = FastAPI()

@app.get("/health")
async def health_check():
    # 用 MongoDB 做一個簡單測試，確定連線成功
    await db.command("ping")
    return {"status": "ok"}