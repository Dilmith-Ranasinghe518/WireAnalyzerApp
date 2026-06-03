from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
import os
import shutil
import subprocess
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in .env")

client = AsyncIOMotorClient(MONGO_URI)
db = client.wireanalyzer
jobs_collection = db.jobs

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/runs", StaticFiles(directory="runs"), name="runs")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/jobs")
async def save_job(request: Request):
    job_data = await request.json()
    job_id = job_data.get("job_id")
    if not job_id:
        raise HTTPException(status_code=400, detail="job_id is required")
        
    await jobs_collection.update_one(
        {"job_id": job_id},
        {"$set": job_data},
        upsert=True
    )
    return {"success": True, "job_id": job_id}

@app.get("/api/jobs")
async def list_jobs():
    cursor = jobs_collection.find({}, {
        "_id": 0,
        "job_id": 1,
        "filename": 1,
        "status": 1,
        "progress_message": 1,
        "created_at": 1,
        "completed_at": 1
    }).sort("created_at", -1)
    jobs = await cursor.to_list(length=100)
    return jobs

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = await jobs_collection.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    target_path = file_path
    if file.filename.lower().endswith('.pdf'):
        try:
            from pdf2image import convert_from_path
            # Use high DPI to ensure thin schematic lines are preserved for OpenCV
            pages = convert_from_path(file_path, dpi=900)
            if pages:
                target_path = file_path + ".png"
                pages[0].save(target_path, "PNG")
        except Exception as e:
            print(f"pdf2image failed: {e}")

    # Run analyzer automatically
    analyzer_script = os.path.join(os.path.dirname(__file__), "services", "wire_analyzer.py")
    result = subprocess.run(
        [
            sys.executable,
            analyzer_script,
            target_path,
            "--dpi",
            "300",
            "--debug"
        ],
        capture_output=True,
        text=True
    )

    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)

    return {
        "success": True,
        "filename": file.filename,
        "output": result.stdout,
        "errors": result.stderr
    }