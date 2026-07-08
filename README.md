# Project Requirements Checklist

Overseas mobility management web app — TAW 2025/2026 project work.
Manages the administrative phases of Ca' Foscari overseas mobility: before departure, during mobility, after return.

## Tech Stack
- **Frontend:** Angular (Single Page Application)
- **Backend:** REST API in JavaScript/TypeScript on Node.js, routing via Express.js
- **Database:** Relational (PostgreSQL)
- **Deployment:** Backend, Database, Frontend each in a **separate Docker container**

---

## 🛠️ Mandatory Infrastructure Requirements
- [x] Backend preloads test data into the database on startup — `database/overseas.sql` seeded via `docker-entrypoint-initdb.d` (98 users, 20 institutions)
- [x] Authentication via JWT, stored in cookies or browser local storage — HS256 token in cookies (`cookies.ts`, `SameSite=Strict; Secure`)
- [x] Each component (backend, database, frontend) runs in its own Docker container — `docker-compose.yml` (pg17 / node20:5000 / angular:4200)

---

## 👥 User & Role Management
- [x] System distinguishes three roles: **Student**, **Referent Lecturer**, **Overseas Office Staff** — `auth.js` ROLE constants + `requireRoles`
- [x] Student can view and modify **only their own** applications — `can_view_application`
- [x] Lecturer can view the applications for which they are the referent — `referent_id` scoping
- [x] Overseas Office can view **all** applications — scoped by `sending_institution` (office = one institution)

---

## 🏛️ Host Institution Management
- [x] Predefined list of partner institutions
- [x] Each institution has at least: name, country, city
- [x] Student chooses the host institution from this list
- [x] (extra) Add new partner institution — `institution/insert` + `partner/insert`
- [ ] (extra) Remove partner institution — keep applications history — **only partner-link delete exists, no institution-delete route**

---

## 📄 Mobility Application

### Status lifecycle
Each application has an overall status:
- [x] created
- [x] awaiting Learning Agreement approval — `learning_agreement_pending`
- [x] pre-departure completed — `pre_departure_completed`
- [x] mobility in progress — `mobility_ongoing`
- [x] waiting for exam score approval — `exam_recognition`
- [x] closed
- [ ] canceled — **not implemented; deletion used instead (`application/delete`)**

---

## ✈️ Step 1 — Before Departure

### Creation (Student)
- [x] Create one or more applications specifying:
  - [x] academic year
  - [x] host institution (from predefined list)
  - [x] expected mobility period (first semester / second semester / entire year)
  - [x] referent lecturer
- [x] Enter exam mapping (foreign courses ↔ Ca' Foscari study plan), each with:
  - [x] foreign teaching code
  - [x] name of the foreign course
  - [x] credits for the foreign course
  - [x] course code in the Ca' Foscari study plan
  - [x] course title in the Ca' Foscari study plan
  - [x] teaching credits in the Ca' Foscari study plan

### Learning Agreement Upload & Evaluation
- [x] Student uploads a Learning Agreement file as part of the application — `document/upload`
- [x] Referent views the application and the document
- [x] Referent approves or rejects the Learning Agreement — `document/:id/decision`
  - [x] record decision date — set by DB trigger
  - [x] record reason (on rejection) — rejection requires motivation

### Pre-departure Verification (Overseas Office)
- [x] Set pre-departure phase complete **only if** essential data present **and** Learning Agreement approved by referent — staff-only status route (guard enforced by DB trigger)

---

## 🌍 Step 2 — During Mobility

### In-Progress Mobility Management (Student)
- [x] Enter actual arrival and departure dates at the host institution — `date_arrived` / `date_departure`

### Learning Agreement Modifications
- [x] Student proposes one or more modifications to the exam mapping, each with:
  - [x] textual description
  - [x] upload of a new Learning Agreement
- [x] Referent approves or rejects each modification — `modification/:id/decision`
  - [x] record decision date — DB trigger
  - [x] record reason (if applicable)
- [x] On rejection: restore original exam mapping and Learning Agreement — transactional snapshot restore (`la_modification_exams`)

---

## 🎓 Step 3 — After Returning

### Transcript of Records Upload (Student)
- [x] Upload the Transcript of Records for the application — `document_type=transcript`
- [x] Update exam list with score obtained and date taken — `mapped_exams.grade` / `date_passed`

### Exam Approval (Referent)
- [x] Review Transcript of Records
- [x] Approve exams taken along with their scores — `document/:id/decision` + mapped_exams status

### Application Closure (Overseas Office)
- [x] Close an application **only when** Transcript of Records uploaded **and** referent approved all exams — staff close route (guard relies on DB trigger — **verify `docs/db/triggers.sql`**)

---

## 🖥️ Frontend Views (Angular SPA)

### Dashboard (top-level)
- [x] Sidebar with entries fetched from the backend based on role — **role filtering done client-side in `app.ts` (`allowed_roles`), not fetched from backend**
- [x] Topbar for quick access

### Authentication
- [x] Login using JWT — `app-login`

### Application Creation (Student)
- [x] Form: academic year, host institution, period, referent — `application-form` (874 lines)
- [x] Exam mappings

### Application Preview (Student, Referent, Overseas)
- [x] Show application information (form input & uploaded files) — `application-view` (432 lines)
- [x] Show exam mappings
- [x] Show uploaded documents (Learning Agreement, Transcript of Records)
- [x] Role-based actions (approve/reject, set pre-departure, close, ...)

---

## ✨ Extra Ideas (optional enrichment)
- [ ] History of uploaded Learning Agreement / Transcript of Records files, with upload date per version — partial (`date_updated` column, no version UI)
- [ ] Document signatures via download/upload — define required signers and signing order, track progress
- [ ] Overseas Office dashboard: applications by status, country, or host institution — partial (`/api/summary`: counts + top institutions)
- [ ] Notifications for incomplete applications — **not done** (existing `Notifications` service is only UI toasts)
