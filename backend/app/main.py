from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, run_migrations
from app.routers import auth, courses, grade_auto, grading, grading_history, sheets, students, tests, users

run_migrations(engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LiveTest", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(tests.router)
app.include_router(sheets.router)
app.include_router(grading.router)
app.include_router(grade_auto.router)
app.include_router(grading_history.router)
app.include_router(students.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
