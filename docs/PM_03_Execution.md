# PHASE 3 — EXECUTION

## Sprint Plan

### Sprint 1 (Week 1-2): Foundation
| Task | Owner | Status |
|------|-------|--------|
| Initialize Node.js backend project | Dev | ✅ Done |
| Design and create SQLite database schema | Dev | ✅ Done |
| Implement Employee CRUD API | Dev | ✅ Done |
| Implement Attendance API with break tracking | Dev | ✅ Done |
| Implement Warning Letters API | Dev | ✅ Done |
| Implement Performance Calculation API | Dev | ✅ Done |
| Implement Payroll Calculation API | Dev | ✅ Done |
| Build PDF Generation Service (all letter types) | Dev | ✅ Done |

### Sprint 2 (Week 2-4): Frontend
| Task | Owner | Status |
|------|-------|--------|
| Setup React + Vite project | Dev | ✅ Done |
| Design dark-mode CSS design system | Dev | ✅ Done |
| Build Dashboard page | Dev | ✅ Done |
| Build Employees management page | Dev | ✅ Done |
| Build Attendance tracker page | Dev | ✅ Done |
| Build Warning Letters page | Dev | ✅ Done |
| Build Performance Rankings page | Dev | ✅ Done |
| Build Payroll Processing page | Dev | ✅ Done |
| Build Settings page | Dev | ✅ Done |

### Sprint 3 (Week 4-5): Testing & Polish
| Task | Owner | Status |
|------|-------|--------|
| End-to-end API testing | Dev | 🔲 Planned |
| UAT with HR Manager | HR Manager | 🔲 Planned |
| Payroll validation with Finance | Finance | 🔲 Planned |
| PDF review by management | HR + Management | 🔲 Planned |
| Bug fixes and refinements | Dev | 🔲 Planned |

---

## Technical Architecture

```
┌─────────────────────────────────────┐
│         React Frontend              │
│  (Vite • React Router • Recharts)  │
│          localhost:3000             │
└──────────────┬──────────────────────┘
               │ HTTP / REST API
               ▼
┌─────────────────────────────────────┐
│        Express.js Backend           │
│          localhost:3001             │
│                                     │
│  Routes:                            │
│  /api/employees  /api/attendance    │
│  /api/warnings   /api/performance   │
│  /api/payroll    /api/settings      │
│  /api/pdf        /pdfs (static)     │
└──────────────┬──────────────────────┘
               │ better-sqlite3
               ▼
┌─────────────────────────────────────┐
│         SQLite Database             │
│         (payroll.db)                │
│                                     │
│  Tables:                            │
│  employees  attendance  warnings    │
│  performance  payroll   settings    │
│  leave_balance                      │
└─────────────────────────────────────┘
```

---

## Performance Scoring Algorithm

```
Total Score = Attendance(40) + Punctuality(25) + Leave Mgmt(20) + Discipline(15)

Attendance Score  = (present_days / total_days) × 40
Punctuality Score = max(0, 25 - (late_count × 5))
Leave Score       = max(0, 20 - (absent_days × 5))
Discipline Score  = max(0, 15 - (warning_count × 5))

Ratings:
  90-100% → Excellent
  75-89%  → Good
  60-74%  → Average
  40-59%  → Needs Improvement
  < 40%   → Poor
```

---

## Deliverables by Sprint

| Deliverable | Responsible | Target Date |
|-------------|-------------|-------------|
| Backend API (all routes) | Developer | Week 2 |
| PDF templates (all types) | Developer | Week 3 |
| Frontend UI (all pages) | Developer | Week 4 |
| Test report | QA / Dev | Week 5 |
| Training material | PM + Dev | Week 6 |
| Go-live deployment | IT + Dev | Week 6 |
