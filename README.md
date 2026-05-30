# Project Requirements Checklist

## Tech Stack
- **Frontend:** Angular
- **Middleware:** Express.js
    **Role based navigations implemented through Express.js**
- **Backend:** Node.js
- **Database:** Relational (PostgreSQL)

---

## 🛠️ Project Requirements
- [ ] Auto populate the database on containerized db

---

## 👥 Entities & Permissions

### Student
- [ ] List of created Mobility Applications
  - [ ] Application Preview
    - [ ] View or add modifications
    - [ ] Upload
  - [ ] Upload transcript of records
- [ ] Application Creation View
  - [ ] Confirm creation (preview the document in a separate view then confirm)

### Lecturer
- [ ] List of existing Mobile Applications assigned to that specific lecturer
  - [ ] Application Preview
    - [ ] Show information (form input & uploaded file)
    - [ ] Show exam mappings
    - [ ] Approve or reject + reason
  - [ ] Approve transcript of records
- [ ] Add exams for its own institution

### Overseas Staff
- [ ] All applications (host institution, guest institution, assigned application)
- [ ] Application Preview
  - [ ] Set pre-departure phase (complete only if approved by lecturer)
  - [ ] Can complete or close
  - [ ] Close application after transcript of records is uploaded
- [ ] Ability to add new partner Institution (extra)
- [ ] Ability to remove partner Institution, + keep applications history? (extra)

---

## 🖥️ Frontend Views & capabilities

### Dashboard (top-level)
- [ ] Sidebar with entries fetched from the db based on role
- [ ] Topbar for quick access to other stuff

### Authentication
- [ ] Login using JWT

### Application Creation
#### Students
- [ ] Form information
- [ ] Exam mappings

### Application Preview
#### Students & Referents
- [ ] Show information about application
- [ ] Show the mapping between exams
- [ ] Show the uploaded documents

