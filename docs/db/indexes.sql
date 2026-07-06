-- index on users.id_institution.
CREATE INDEX IF NOT EXISTS idx_users_id_institution
    ON users (id_institution);
-- composite index on (id_institution, role).
CREATE INDEX IF NOT EXISTS idx_users_institution_role
    ON users (id_institution, role);


-- index on applications.user_id.
CREATE INDEX IF NOT EXISTS idx_applications_user_id
    ON applications (user_id);
-- index on applications.referent_id.
CREATE INDEX IF NOT EXISTS idx_applications_referent_id
    ON applications (referent_id);
-- index on applications.host_institution.
CREATE INDEX IF NOT EXISTS idx_applications_host_institution
    ON applications (host_institution);
-- index on applications.sending_institution.
CREATE INDEX IF NOT EXISTS idx_applications_sending_institution
    ON applications (sending_institution);

-- index on applications.status.
CREATE INDEX IF NOT EXISTS idx_applications_status
    ON applications (status);
-- index on applications.date_submitted (descending).
CREATE INDEX IF NOT EXISTS idx_applications_date_submitted_desc
    ON applications (date_submitted DESC);


-- index on exams.id_institution.
CREATE INDEX IF NOT EXISTS idx_exams_id_institution
    ON exams (id_institution);


-- index on mapped_exams.application_id.
CREATE INDEX IF NOT EXISTS idx_mapped_exams_application_id
    ON mapped_exams (application_id);
-- index on mapped_exams.host_exam_id.
CREATE INDEX IF NOT EXISTS idx_mapped_exams_host_exam_id
    ON mapped_exams (host_exam_id);
--index on mapped_exams.sending_exam_id.
CREATE INDEX IF NOT EXISTS idx_mapped_exams_sending_exam_id
    ON mapped_exams (sending_exam_id);
-- composite index on (application_id, status).
CREATE INDEX IF NOT EXISTS idx_mapped_exams_application_status
    ON mapped_exams (application_id, status);


-- index on uploaded_documents.application_id.
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_application_id
    ON uploaded_documents (application_id);
-- index on uploaded_documents.user_id.
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_user_id
    ON uploaded_documents (user_id);
-- composite index on (application_id, document_type, date_updated DESC).
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_app_type_date
    ON uploaded_documents (application_id, document_type, date_updated DESC);
-- composite index on (application_id, document_type, status).
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_app_type_status
    ON uploaded_documents (application_id, document_type, status);


-- index on partner_institution.id_partner_institution.
CREATE INDEX IF NOT EXISTS idx_partner_institution_partner_id
    ON partner_institution (id_partner_institution);


-- composite index on (application_id, status); its leftmost prefix also covers
-- lookups by application_id alone, so no separate single-column index is needed.
CREATE INDEX IF NOT EXISTS idx_la_modifications_app_status
    ON la_modifications (application_id, status);
-- index on la_modification_exams.modification_id.
CREATE INDEX IF NOT EXISTS idx_la_modification_exams_modification_id
    ON la_modification_exams (modification_id);
