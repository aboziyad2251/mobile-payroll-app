# PHASE 2 — PROJECT PLANNING

## Work Breakdown Structure (WBS)

```
PayrollPro
├── 1. Project Management
│   ├── 1.1 Kickoff Meeting
│   ├── 1.2 Stakeholder Analysis
│   ├── 1.3 Risk Register
│   └── 1.4 Communication Plan
├── 2. Backend Development
│   ├── 2.1 Database Schema Design
│   ├── 2.2 Employee CRUD API
│   ├── 2.3 Attendance API
│   ├── 2.4 Warning Letter API
│   ├── 2.5 Performance Calculation API
│   ├── 2.6 Payroll Calculation API
│   └── 2.7 PDF Generation Service
├── 3. Frontend Development
│   ├── 3.1 Design System & CSS
│   ├── 3.2 Dashboard
│   ├── 3.3 Employee Management UI
│   ├── 3.4 Attendance Tracker UI
│   ├── 3.5 Warning Letters UI
│   ├── 3.6 Performance Rankings UI
│   ├── 3.7 Payroll Processing UI
│   └── 3.8 Settings UI
├── 4. Testing
│   ├── 4.1 API Unit Tests
│   ├── 4.2 UI Integration Tests
│   └── 4.3 User Acceptance Testing (UAT)
└── 5. Deployment & Handover
    ├── 5.1 Final Deployment
    ├── 5.2 User Training
    └── 5.3 Documentation Handover
```

---

## Project Schedule (Gantt Overview)

| Task | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Week 6 |
|------|--------|--------|--------|--------|--------|--------|
| Database Design | ████   |        |        |        |        |        |
| Backend API     | ████   | ████   |        |        |        |        |
| Frontend UI     |        | ████   | ████   |        |        |        |
| PDF Generation  |        |        | ████   |        |        |        |
| Testing (UAT)   |        |        |        | ████   | ████   |        |
| Training & Deploy|       |        |        |        | ████   | ████   |

---

## Risk Register

| # | Risk | Probability | Impact | Score | Mitigation |
|---|------|-------------|--------|-------|------------|
| R1 | Incorrect payroll calculations | Medium | 🔴 High | 6 | Double-validation, UAT with Finance Manager |
| R2 | Data loss / DB corruption | Low | 🔴 High | 4 | Daily SQLite backup scripts |
| R3 | User adoption resistance | Medium | 🟡 Medium | 4 | Training sessions, intuitive UI/UX |
| R4 | Scope creep from stakeholders | High | 🟡 Medium | 6 | Formal change control process |
| R5 | Late delivery | Medium | 🟡 Medium | 4 | Buffer sprints, weekly reviews |
| R6 | PDF generation errors | Low | 🟡 Medium | 2 | Template testing before release |
| R7 | Security breach / unauthorized access | Low | 🔴 High | 4 | Add login system in Phase 2 |

---

## Resource Plan

| Resource | Role | Allocation | Duration |
|----------|------|------------|----------|
| Lead Developer | Full-stack developer | 100% | 6 weeks |
| HR Manager | SME + UAT Lead | 20% | Weeks 4-5 |
| Finance Manager | UAT + Validation | 10% | Week 5 |
| IT Admin | Deployment support | 20% | Week 6 |

---

## Budget Estimate

| Item | Cost |
|------|------|
| Developer time (6 weeks) | Internal |
| Server / hosting | $0 (local SQLite) |
| Software licenses | $0 (open source stack) |
| Training | Internal |
| **Total External Cost** | **$0** |

---

## Quality Plan

- Code review before each merge
- API endpoints tested with sample data for all 30 employees
- Payroll validated against manual calculation for 3 test employees
- PDF templates reviewed by HR Manager before go-live
