from sqlalchemy import Column, Integer, String
from app.database import Base

class LearnerProfile(Base):
    __tablename__ = "learners"

    id = Column(Integer, primary_key=True, index=True)
    pseudonym = Column(String)  # Example: "Blue Lion 42" instead of a real name [cite: 27]
    grade = Column(String)
    support_needs = Column(String) # Encrypted string of adaptations [cite: 28]