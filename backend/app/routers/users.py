from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_auth
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def search_users(
    role: str | None = Query(None),
    q: str = Query(""),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if q.strip():
        search = f"%{q.strip()}%"
        query = query.filter(
            (User.name.ilike(search)) | (User.email.ilike(search))
        )
    results = query.limit(20).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role}
        for u in results
    ]
