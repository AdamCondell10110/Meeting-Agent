import json
from fastapi import APIRouter
from google.genai import types
from models import ChatRequest
from ai_client import client

router = APIRouter()


@router.post("/chat")
async def chat(request: ChatRequest):
    context = f"""You are an AI meeting assistant with full access to the meeting below.

TRANSCRIPT:
{request.transcript}

ANALYSIS:
Summary: {request.analysis.get('summary', '')}
Action items: {json.dumps(request.analysis.get('action_items', []))}
Decisions: {json.dumps(request.analysis.get('decisions', []))}
Risks: {json.dumps(request.analysis.get('risks', []))}

Answer questions about this meeting helpfully and concisely. When asked to draft content such as emails or messages, produce ready-to-use text."""

    contents = [
        types.Content(role="user", parts=[types.Part(text=context)]),
        types.Content(role="model", parts=[types.Part(text="Understood. I have the transcript and analysis. How can I help?")]),
    ]
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg.content)]))

    response = client.models.generate_content(model="gemini-3.5-flash", contents=contents)
    return {"reply": response.text}
