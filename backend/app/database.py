from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATA_DIR

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATA_DIR / 'livetest.db'}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def run_migrations(eng):
    """Add columns to existing tables if they don't exist yet (SQLite-safe)."""
    migrations = [
        # tests
        "ALTER TABLE tests ADD COLUMN course_id INTEGER REFERENCES courses(id)",
        "ALTER TABLE tests ADD COLUMN created_by_id INTEGER REFERENCES users(id)",
        # generated_sheets
        "ALTER TABLE generated_sheets ADD COLUMN student_id INTEGER REFERENCES users(id)",
        # qr_codes
        "ALTER TABLE qr_codes ADD COLUMN student_id INTEGER REFERENCES users(id)",
        # grading_results
        "ALTER TABLE grading_results ADD COLUMN generated_sheet_id INTEGER REFERENCES generated_sheets(id)",
        # grading_history
        "ALTER TABLE grading_history ADD COLUMN student_id INTEGER REFERENCES users(id)",
        "ALTER TABLE grading_history ADD COLUMN sheet_id INTEGER REFERENCES generated_sheets(id)",
        "ALTER TABLE grading_history ADD COLUMN qr_code_id INTEGER REFERENCES qr_codes(id)",
        "ALTER TABLE grading_history ADD COLUMN annotated_image_path VARCHAR(500)",
        "ALTER TABLE grading_history ADD COLUMN processed_image_path VARCHAR(500)",
        "ALTER TABLE grading_history ADD COLUMN ambiguous_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE grading_history ADD COLUMN updated_at DATETIME",
    ]
    with eng.connect() as conn:
        for m in migrations:
            try:
                conn.execute(text(m))
                conn.commit()
            except Exception:
                pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
