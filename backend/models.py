from typing import Literal
from pydantic import BaseModel


class TranscriptRequest(BaseModel):
    transcript: str
    mode: Literal["quick", "deep"] = "deep"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    transcript: str
    analysis: dict
    messages: list[ChatMessage]
