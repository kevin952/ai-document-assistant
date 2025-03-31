from openai import OpenAI
from dotenv import load_dotenv
import base64
load_dotenv()

class VoiceProcessor:
    def __init__(self):
        self.client = OpenAI()

    async def process_voice(self, audio_base64: str) -> str:
        """Convert voice input to text using OpenAI's Whisper model"""
        try:
            # Decode base64 audio
            audio_data = base64.b64decode(audio_base64)
            
            # Save audio temporarily
            with open("temp_audio.mp3", "wb") as f:
                f.write(audio_data)
            
            # Transcribe audio using Whisper
            with open("temp_audio.mp3", "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
            
            # Clean up temporary file
            import os
            os.remove("temp_audio.mp3")
            
            return transcript.text
            
        except Exception as e:
            raise Exception(f"Error processing voice input: {str(e)}") 