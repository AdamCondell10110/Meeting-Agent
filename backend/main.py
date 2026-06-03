import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class TranscriptRequest(BaseModel): 
    transcript: str

@app.post("/analyse")
async def analyse_transcript(request: TranscriptRequest):
    prompt = f"""
    You are an AI meeting assistant. Analyse the following meeting transcript and return a JSON object with exactly this structure:

    {{
    "summary": "2-3 sentence summary of the meeting",
    "action_items": [
        {{"owner": "name", "task": "what they need to do", "deadline": "deadline if mentioned"}}
    ],
    "risks": ["any unresolved issues or risks flagged"],
    "decisions": ["key decisions made in the meeting"]
    }}

    Return only valid JSON, no extra text.


    Transcript:
    {request.transcript}
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    raw_json = response.text.replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(raw_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response as JSON")

    return result