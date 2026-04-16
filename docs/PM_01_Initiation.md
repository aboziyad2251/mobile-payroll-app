# PayrollPro — Project Management Documentation

## Project Overview
| Field | Details |
|-------|---------|
| **Project Name** | PayrollPro — HR & Payroll Management System |
| **Client** | Small Firm (~30 Employees) |
| **Start Date** | February 2025 |
| **Target Completion** | April 2025 |
| **Project Manager** | TBD |
| **Classification** | Internal Enterprise Application |

---

## 📋 PHASE 1 — PROJECT INITIATION

### Project Charter

**Purpose:** Develop a comprehensive web-based payroll and HR management system to replace manual spreadsheet processes for a small firm of approximately 30 employees.

**Business Need:** The organization requires an automated system to:
- Eliminate manual payroll errors
- Track employee attendance, leave, and performance digitally
- Generate official documents (warning letters, payslips) in PDF format
- Provide performance rankings to support HR decisions

**High-Level Scope:**
- Employee database management
- Daily attendance tracking with break times
- Leave management (annual, sick, emergency, excused)
- Warning letter system (1st, 2nd, 3rd, Final, Recognition)
- Payroll calculation with allowances and deductions
- Employee performance appraisal with ranking
- PDF report and letter generation

**Constraints:**
- Budget: Internal IT build (no external vendor)
- Tech Stack: Node.js + React + SQLite (no cloud costs)
- Team: Small development team

**Assumptions:**
- Work hours: 8:00 AM – 4:00 PM
- Break duration: 40 minutes
- Late threshold: 15 minutes after work start
- Working days: 22 per month
- No simultaneous payroll period conflicts

---

## 👥 Top 10 Key Stakeholders

| # | Stakeholder | Role | Interest | Influence | Engagement Strategy |
|---|-------------|------|----------|-----------|---------------------|
| 1 | **CEO / Managing Director** | Executive Sponsor | ROI, compliance, efficiency | 🔴 High | Monthly executive briefings |
| 2 | **HR Manager** | Primary User & System Owner | Full HR module control | 🔴 High | Weekly demos, UAT lead |
| 3 | **Finance / Accounting Manager** | Payroll Approver | Salary accuracy, reports | 🔴 High | Payroll validation sessions |
| 4 | **IT Administrator** | System Administrator | Infrastructure, data security | 🟡 Medium | Tech walkthroughs, deployment |
| 5 | **Department Managers** | Secondary Users | Team attendance, performance | 🟡 Medium | Training sessions, role access |
| 6 | **All Employees (~30)** | End Users (Attendance/Payslips) | Accurate pay, leave balance | 🟡 Medium | User guide, payslip access |
| 7 | **Legal / Compliance Officer** | Policy Reviewer | Labor law compliance | 🟡 Medium | Document review checkpoints |
| 8 | **Project Manager** | Delivery Owner | On-time, on-budget delivery | 🔴 High | Daily standups, sprint reviews |
| 9 | **Lead Developer** | Technical Implementer | Code quality, architecture | 🟡 Medium | Code reviews, architecture docs |
| 10 | **External Auditor** (if applicable) | Audit Observer | Data accuracy, record keeping | 🟢 Low | Quarterly report exports |

### Stakeholder Engagement Matrix

| Stakeholder | Current State | Desired State | Action Required |
|-------------|---------------|---------------|-----------------|
| CEO | Unaware | Supportive | Executive briefing + ROI presentation |
| HR Manager | Resistive (manual habits) | Leading | Hands-on demo, co-design sessions |
| Finance Manager | Neutral | Supportive | Show payroll automation benefits |
| Employees | Unaware | Neutral | Announcement memo + user guide |
| IT Admin | Neutral | Supportive | Technical documentation handover |

---

*Documents:* Project Charter (this document), Stakeholder Register, Scope Statement
