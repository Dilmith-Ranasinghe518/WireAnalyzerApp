import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def test_conn():
    try:
        uri = os.environ.get("MONGO_URI")
        if not uri:
            raise ValueError("MONGO_URI is not set in .env")
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        print("MongoDB connection SUCCESS!")
    except Exception as e:
        print("MongoDB connection FAILED:", e)

asyncio.run(test_conn())
