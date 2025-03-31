from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from .document_processor import DocumentProcessor
from .search_engine import SearchEngine
from .voice_processor import VoiceProcessor
import logging

# Configure logging to only show errors
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

app = FastAPI(title="Company Knowledge Base Chatbot")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
document_processor = DocumentProcessor()
search_engine = SearchEngine()
voice_processor = VoiceProcessor()

class Query(BaseModel):
    text: str
    model: Optional[str] = "gpt-4"
    voice: Optional[bool] = False

@app.on_event("startup")
async def startup_event():
    try:
        # Initialize document processor
        global doc_processor
        doc_processor = DocumentProcessor()
        
        # Check if vectorstore exists
        vectorstore_path = os.path.join(os.path.dirname(__file__), "data", "vectorstore")
        if not os.path.exists(vectorstore_path) or not os.listdir(vectorstore_path):
            logger.info("Vectorstore not found or empty. Processing documents...")
            doc_processor.process_all_documents()
        else:
            logger.info("Vectorstore already exists. Skipping document processing.")
            
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        await document_processor.process_document(file)
        return {"message": "File processed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query")
async def query(query: Query):
    try:
        logger.info(f"Processing query: {query.text} with model: {query.model}")
        result = search_engine.search(query.text, query.model)
        logger.info(f"Query result: {result}")
        return {"results": {"answer": result}}
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
async def list_documents():
    """List all processed documents"""
    try:
        documents = await document_processor.list_documents()
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 