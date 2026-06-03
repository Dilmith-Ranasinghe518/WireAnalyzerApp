import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test_conn():
    try:
        client = AsyncIOMotorClient("mongodb+srv://admin:Cj1fYopndjY6fCmz@cluster0.z3zgd.mongodb.net/wireanalyzer?retryWrites=true&w=majority&appName=cluster0", serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        print("MongoDB connection SUCCESS!")
    except Exception as e:
        print("MongoDB connection FAILED:", e)

asyncio.run(test_conn())
