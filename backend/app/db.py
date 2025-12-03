import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# 讀取 backend/.env
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME")

if not MONGODB_URI or not DB_NAME:
    raise RuntimeError("MONGODB_URI or DB_NAME is not set in .env")

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DB_NAME]