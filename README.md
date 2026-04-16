# PayrollPro — HR & Payroll Management System

A comprehensive web application for managing payroll, attendance, warnings, and employee performance for small firms.

## 🚀 Quick Start

**Double-click `start.bat`** — it will auto-install dependencies and launch both servers.

Then open: **http://localhost:3000**

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 👥 Employees | Add/edit employees with full salary breakdown |
| ⏰ Attendance | Daily tracking with 6 status types + break times |
| ⚠️ Warnings | 1st, 2nd, 3rd, Final warnings + Recognition with PDF generation |
| 📊 Performance | Daily/weekly/monthly rankings with 4-factor scoring |
| 💰 Payroll | Auto-calculate gross/net pay with deductions + payslips |
| ⚙️ Settings | Configure work hours, thresholds, company info |

## 📋 Attendance Statuses
- ✅ **Present** — with check-in/out and break time
- ❌ **Absent** — unexcused
- 🏖️ **Annual Leave**
- 🤒 **Sick Leave**
- 🚨 **Emergency Leave**
- ✔️ **Excused**

## 📄 PDF Documents Generated
1. 1st Warning Letter
2. 2nd Warning Letter
3. 3rd Warning Letter
4. Final Warning / Termination Notice
5. Recognition / Excellence Certificate
6. Employee Payslip

## 📐 Performance Formula
```
Total Score (100%) =
  Attendance     40%  (present days ratio)
  Punctuality    25%  (-5pts per late arrival)
  Leave Mgmt     20%  (-5pts per unexcused absent)
  Discipline     15%  (-5pts per warning received)
```

| Score | Rating |
|-------|--------|
| 90–100% | Excellent |
| 75–89% | Good |
| 60–74% | Average |
| 40–59% | Needs Improvement |
| < 40% | Poor |

## 🏗️ Tech Stack
- **Backend:** Node.js + Express + better-sqlite3 + pdfkit
- **Frontend:** React 18 + Vite + Recharts + React Router
- **Database:** SQLite (auto-created as `backend/payroll.db`)

## 📁 Project Structure
```
payroll-gemini/
├── start.bat              ← Run this to start!
├── backend/
│   ├── server.js
│   ├── database.js
│   ├── routes/
│   │   ├── employees.js
│   │   ├── attendance.js
│   │   ├── warnings.js
│   │   ├── performance.js
│   │   ├── payroll.js
│   │   ├── settings.js
│   │   └── pdf.js
│   └── pdfs/             ← Generated PDFs saved here
├── frontend/
│   └── src/
│       ├── pages/        ← All 7 pages
│       └── services/api.js
└── docs/
    ├── PM_01_Initiation.md
    ├── PM_02_Planning.md
    ├── PM_03_Execution.md
    ├── PM_04_Control.md
    └── PM_05_Closure.md
```

## ⚙️ Default Configuration
| Setting | Default |
|---------|---------|
| Work Start | 08:00 AM |
| Work End | 04:00 PM |
| Break Duration | 40 minutes |
| Late Threshold | 15 minutes |
| Recognition Score | 85%+ |
| Working Days/Month | 22 |
