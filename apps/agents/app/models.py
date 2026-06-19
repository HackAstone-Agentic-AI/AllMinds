from pydantic import BaseModel, Field

class ChatInput(BaseModel):
    # This limits the text to 500 characters so no one can "overflow" your server
    message: str = Field(..., max_length=500) 
    user_id: str