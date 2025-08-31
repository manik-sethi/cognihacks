from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from emotiv_backend import get_confusion_level

app = FastAPI()

# Allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # or ["*"] for all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/confusion")
def read_confusion():
    return {"confusionLevel": get_confusion_level()}
