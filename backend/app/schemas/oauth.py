from pydantic import BaseModel

class GoogleAuthUrlResponse(BaseModel):
    auth_url: str

class GithubAuthUrlResponse(BaseModel):
    auth_url: str