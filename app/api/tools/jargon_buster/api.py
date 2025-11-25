from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ConnectBest Jargon Buster Agent",
    description="Agent for explaining enterprise jargon using RAG",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
pc = None
pinecone_index = None
embedding_model = None
groq_client = None

PINECONE_INDEX_NAME = "connectbest-chat"
PINECONE_NAMESPACE = "jargon"

@app.on_event("startup")
async def startup_event():
    global pc, pinecone_index, embedding_model, groq_client
    
    pinecone_api_key = os.getenv("PINECONE_API_KEY")
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    if not pinecone_api_key or not groq_api_key:
        raise ValueError("PINECONE_API_KEY and GROQ_API_KEY must be set")
    
    pc = Pinecone(api_key=pinecone_api_key)
    pinecone_index = pc.Index(PINECONE_INDEX_NAME)
    
    print("Loading model...")
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Model loaded")
    
    groq_client = Groq(api_key=groq_api_key)

class JargonRequest(BaseModel):
    term: str = Field(..., description="Jargon term or acronym to explain")
    context: str = Field(default="", description="Optional context where the term was used")

class JargonResponse(BaseModel):
    term: str
    definition: str
    explanation: str
    source: str

@app.post("/api/jargon-buster", response_model=JargonResponse)
async def explain_jargon(request: JargonRequest):
    try:
        # 1. Embed Query
        query_embedding = embedding_model.encode(request.term).tolist()
        
        # 2. Search Pinecone
        search_results = pinecone_index.query(
            namespace=PINECONE_NAMESPACE,
            vector=query_embedding,
            top_k=1,
            include_metadata=True
        )
        
        if not search_results['matches']:
            # Fallback to LLM only if not found in glossary?
            # Or return "I don't know this internal term".
            # Let's try LLM fallback with a warning.
            retrieved_context = "No internal definition found."
            source = "General Knowledge (LLM)"
        else:
            match = search_results['matches'][0]
            if match['score'] < 0.7: # Threshold
                 retrieved_context = "No exact internal match found."
                 source = "General Knowledge (LLM)"
            else:
                retrieved_context = match['metadata']['definition']
                source = "Internal Glossary"
        
        # 3. Generate Explanation with Groq
        prompt = f"""
        You are an expert at explaining enterprise jargon to new employees.
        
        Term: {request.term}
        Context: {request.context}
        Internal Glossary Definition: {retrieved_context}
        
        Please explain this term simply. If an internal definition exists, prioritize it. 
        If not, use your general knowledge but mention it might not be specific to this company.
        """
        
        completion = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "Explain clearly and concisely."},
                {"role": "user", "content": prompt}
            ]
        )
        
        explanation = completion.choices[0].message.content
        
        return JargonResponse(
            term=request.term,
            definition=retrieved_context,
            explanation=explanation,
            source=source
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
