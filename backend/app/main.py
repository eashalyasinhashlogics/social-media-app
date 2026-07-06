from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS, APP_NAME, APP_VERSION, DEBUG
from app.db.database import test_database_connection
from app.api.v1.api import api_router

app = FastAPI(title=APP_NAME, version=APP_VERSION, debug=DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print(f"Starting {APP_NAME} v{APP_VERSION}")
    test_database_connection()

@app.get("/health")
def health_check():
    return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}

@app.get("/")
def root():
    return {"message": f"Welcome to {APP_NAME}", "version": APP_VERSION, "docs": "/docs"}

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
