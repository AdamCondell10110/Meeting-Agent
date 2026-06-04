import os
import json
from typing import Literal
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

JSON_SCHEMA = """
{
"summary": "...",
"action_items": [
    {"owner": "name", "task": "what they need to do", "deadline": "deadline if mentioned"}
],
"risks": ["any unresolved issues or risks flagged"],
"decisions": ["key decisions made in the meeting"]
}
"""


class TranscriptRequest(BaseModel):
    transcript: str
    mode: Literal["quick", "deep"] = "deep"


def build_prompt(mode: Literal["quick", "deep"], transcript: str) -> str:
    if mode == "quick":
        instructions = """
You are an AI meeting assistant. Provide a quick summary of the following meeting transcript.

Return a JSON object with exactly this structure:
{
"summary": "A concise 2-4 sentence summary of the meeting",
"action_items": [],
"risks": [],
"decisions": []
}

Populate only the summary field. Leave action_items, risks, and decisions as empty arrays.
Return only valid JSON, no extra text.
"""
    else:
        instructions = f"""
You are an AI meeting assistant. Perform a deep analysis of the following meeting transcript and return a JSON object with exactly this structure:

{JSON_SCHEMA}

Instructions:
- summary: Write a thorough 4-6 sentence summary covering purpose, key topics, and outcomes.
- action_items: Extract every action item mentioned. Include owner, task, and deadline when stated.
- decisions: List every decision made, including tentative or deferred decisions.
- risks: List every risk, blocker, or unresolved issue raised.

Return only valid JSON, no extra text.
"""

    return f"{instructions}\n\nTranscript:\n{transcript}"


@app.post("/analyse")
async def analyse_transcript(request: TranscriptRequest):
    prompt = build_prompt(request.mode, request.transcript)

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
