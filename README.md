# LiveTest — OMR Exam Platform

A full-stack web application for creating multiple-choice exams, generating OMR answer sheets, scanning and grading sheets automatically, and managing courses with teacher/student roles.

Powered by **OpenCV** for optical mark recognition (OMR), with a grading engine inspired by [OMRChecker](https://github.com/Udayraj123/OMRChecker).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 18 + TypeScript + TailwindCSS |
| Backend | FastAPI + Python 3.13 |
| Database | SQLite (SQLAlchemy ORM) |
| OMR Engine | OpenCV (perspective correction, bubble detection) |
| Image Generation | Pillow (answer sheets, proof images) |
| QR Codes | qrcode (generation) + OpenCV QRCodeDetector (decoding) |
| Auth | JWT (PyJWT) + pbkdf2_hmac password hashing |
| i18n | i18next + react-i18next (Spanish / English) |

## Features

### Core OMR Workflow
- Create multi-choice exams with **variable per-question option counts** (2–8 options)
- Generate printable answer sheets with **QR codes** for automatic test identification
- Scan/upload completed sheets — automatic **perspective correction**, bubble detection, and scoring
- **Camera mode** — grade sheets in real-time using device camera (1-second frame scanning)
- Visual **proof images** with color-coded annotations (green=correct, red=incorrect, gray=blank)

### Multi-User Platform
- **Teacher** and **student** roles with JWT authentication
- **Courses** — organize exams by subject, multiple teachers per course
- **Student enrollment** — assign students to courses and exams
- Role-based permissions — students see only their own grades, teachers manage courses
- **Class statistics** — average, highest score, submission counts

### Sheet Management
- Download answer sheets and answer keys as **PNG** or **PDF**
- **Editable answer key** — change correct answers after test creation
- In-browser **print preview** with sheet-only printing (no browser chrome)
- Score distribution charts on test detail page

### Grading History
- Per-student grading records with annotated proof images
- Full history browsable by test, sheet, or student
- Auto-detect mode: upload or scan any sheet, QR identifies the test automatically

### Internationalization (i18n)
- Full Spanish and English support
- Language switcher in Settings (persisted to localStorage)
- Generated sheets render in the selected language

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### One-command start

```bash
./start.sh
```

This installs dependencies for both services and starts:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

### Manual start

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` requests to the backend automatically.

## Project Structure

```
livetest-mvp/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── database.py             # SQLAlchemy + SQLite setup
│   │   ├── models.py               # 11 models: User, Course, Test, GradingHistory, etc.
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   ├── auth.py                 # JWT + password hashing + permission guards
│   │   ├── routers/
│   │   │   ├── auth.py             # Register / Login
│   │   │   ├── tests.py            # Test CRUD + student assignment + stats
│   │   │   ├── courses.py          # Course CRUD + teacher/student management
│   │   │   ├── sheets.py           # Sheet generation, PNG/PDF download
│   │   │   ├── grading.py          # Manual grading (upload + grade)
│   │   │   ├── grade_auto.py       # Auto-detect grading (QR + camera frames)
│   │   │   ├── grading_history.py  # History CRUD + proof image serving
│   │   │   ├── students.py         # Student profile, grades, tests
│   │   │   └── users.py            # User search (for course member adding)
│   │   ├── services/
│   │   │   ├── omr_template_service.py      # Builds OMR layout JSON from template
│   │   │   ├── sheet_generator_service.py   # Pillow-based sheet/key image + PDF
│   │   │   ├── grading_service.py           # OpenCV alignment + bubble detection
│   │   │   └── grading_history_service.py   # Proof image generation
│   │   └── storage/
│   │       ├── generated_sheets/   # Generated PNG images
│   │       ├── pdfs/               # Generated PDF files
│   │       ├── processed/          # Perspective-corrected images
│   │       ├── proofs/             # Annotated proof images
│   │       └── uploads/            # Uploaded scans
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Router + role-based layout
│   │   ├── main.tsx                # React entry + i18n init
│   │   ├── index.css               # Tailwind + custom utilities + print styles
│   │   ├── auth/
│   │   │   └── AuthContext.tsx      # Auth state, login/logout, authFetch
│   │   ├── i18n/
│   │   │   ├── index.ts            # i18next configuration
│   │   │   └── locales/            # es.json, en.json translation files
│   │   ├── api/client.ts           # API client with auth token injection
│   │   ├── pages/                  # 15 page components
│   │   └── components/             # ExamCard, Navigation, CameraScanner, etc.
│   ├── package.json
│   └── vite.config.ts
└── start.sh                        # One-command dev launcher
```

## OMR Engine — How Grading Works

The grading engine follows the same approach as OMRChecker, processing sheets in a pipeline:

### 1. Template Layout
When a test is created, the backend generates an OMR template JSON with precise pixel coordinates for every element:

```json
{
  "page_width": 1700, "page_height": 2200,
  "markers": { "top_left": {"x":80,"y":80,"size":40}, ... },
  "questions": [
    { "number": 1, "x": 90, "y": 346,
      "options": [
        { "label":"A","cx":180,"cy":340,"r":18 },
        { "label":"B","cx":236,"cy":340,"r":18 }
      ]
    }
  ]
}
```

The layout supports **multi-column rendering** — when questions exceed the page height, they flow into new columns automatically.

### 2. Alignment (`_align_and_crop`)
- Finds 4 corner alignment markers (40×40px black squares) via OpenCV contour detection
- Validates markers are within expected positions (±15% of page diagonal)
- Computes a **perspective transform** (`cv2.getPerspectiveTransform`) to correct skewed photos
- Warps the image to the template's exact dimensions (1700×2200 at 150 DPI)

### 3. Bubble Detection (`_read_bubble`)
- For each bubble in the layout JSON, reads the **mean pixel intensity** inside its circle
- Uses a circular mask with `cv2.mean()` — darker = more filled

### 4. Fill Detection (`_detect_filled`)
- Compares intensities across all options for a question
- If intensity range < 15 → treated as **blank**
- If exactly one option is below `min + range × 0.4` threshold → that option is **filled**
- Otherwise → **blank** (ambiguous or not filled)

### 5. Marker Validation
Before grading, the system validates that the uploaded image is an actual OMR sheet:
- All 4 corner markers must be detected within tolerance
- The 4 points must form a valid quadrilateral (convex hull area > 10% of image)
- Invalid images return `"Processing failed: no markers detected"` — random photos are rejected

### 6. QR Code
Each sheet has a 120×120px QR code in the top-right corner containing a 12-hex-char identifier. The full metadata (test ID, sheet ID, student ID) is stored in the `qr_codes` database table. Camera mode decodes QR codes every second to identify the test automatically.

### 7. Proof Images
After grading, an annotated proof image is generated:
- **Green circle + ✓** on the correct answer for every question
- **Red circle + ✕** on the student's wrong pick (if any)
- **Black filled circle** on the correct answer in answer key sheets
- Stored in `storage/proofs/` and viewable from the grading history

## Database Models

| Model | Description |
|-------|-------------|
| `User` | name, email, password_hash, role (teacher/student) |
| `Course` | name, description, created_by |
| `CourseTeacher` | many-to-many: course ↔ teacher |
| `CourseStudent` | many-to-many: course ↔ student |
| `ExamAssignment` | test ↔ student assignment |
| `Test` | name, description, course, creator, question/option counts |
| `OMRTemplate` | layout JSON + marker config per test |
| `Evaluation` | answer key JSON + scoring config per test |
| `GeneratedSheet` | sheet file paths, optional student assignment |
| `QRCode` | 12-hex identifier → test/sheet/student lookup |
| `GradingResult` | detected answers, score, per-question breakdown |
| `GradingHistory` | original/processed/annotated image paths, scores, student link |

## API Endpoints (high-level)

| Prefix | Purpose |
|--------|---------|
| `/auth` | Register, login (JWT) |
| `/tests` | Test CRUD, student assignment, answer key editing, stats |
| `/tests/{id}/sheets` | Generate sheets, download PNG/PDF, answer key images |
| `/tests/{id}/grading` | Manual grading (upload + grade) |
| `/grade` | Auto-detect grading, camera frame detection |
| `/grading-history` | History CRUD, proof image serving, per-test/student queries |
| `/courses` | Course CRUD, teacher/student management |
| `/students` | Student profile, grades, assigned tests |
| `/users` | User search (for adding to courses) |

## Design

- **Light theme** — clean SaaS aesthetic (Notion/Linear inspired)
- **Mobile-first** — bottom nav on mobile, collapsible sidebar on desktop
- **TailwindCSS** — custom `brand-*` color palette, Inter font
- **Lucide icons** — consistent icon set throughout
- **Print styles** — `@media print` rules for clean sheet printing

## Deployment

Single-service deployment — FastAPI serves both API and static files:

```python
# Add to main.py:
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
```

Build the frontend (`npm run build` in `frontend/`) and deploy the `backend/` folder to Render, Fly.io, Railway, or any VPS running Python.

## License

MIT
