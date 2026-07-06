-- institutions enriched with the count of partner links.
CREATE OR REPLACE VIEW institution_partner_count_view AS
SELECT
    i.id,
    i.name,
    i.country,
    i.city,
    COUNT(pi.id) AS partner_count
FROM institutions i
LEFT JOIN partner_institution pi ON pi.id_institution = i.id
GROUP BY i.id, i.name, i.country, i.city;


-- number of applications grouped by status.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_applications_by_status AS
SELECT
    status,
    COUNT(*) AS applications_count
FROM applications
GROUP BY status;


-- number of applications grouped by host institution
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_applications_by_host_institution AS
SELECT
    hi.id               AS host_institution_id,
    hi.name             AS host_institution_name,
    hi.country          AS host_institution_country,
    COUNT(a.id)         AS applications_count
FROM applications a
JOIN institutions hi ON hi.id = a.host_institution
GROUP BY hi.id, hi.name, hi.country;


-- per-institution snapshot: number of students, number of staff, number of referents, number of exams, number of sent applications, number of hosted applications, number of partner institutions.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_institution_activity AS
SELECT
    i.id                AS institution_id,
    i.name,
    i.country,
    i.city,
    (SELECT COUNT(*) FROM users u WHERE u.id_institution = i.id AND u.role = 'student')   AS students_count,
    (SELECT COUNT(*) FROM users u WHERE u.id_institution = i.id AND u.role = 'staff')     AS staff_count,
    (SELECT COUNT(*) FROM users u WHERE u.id_institution = i.id AND u.role = 'referent')  AS referents_count,
    (SELECT COUNT(*) FROM exams e WHERE e.id_institution = i.id)                          AS exams_count,
    (SELECT COUNT(*) FROM applications a WHERE a.sending_institution = i.id)              AS sent_applications,
    (SELECT COUNT(*) FROM applications a WHERE a.host_institution = i.id)                 AS hosted_applications,
    (SELECT COUNT(*) FROM partner_institution pi WHERE pi.id_institution = i.id)          AS partners_count
FROM institutions i;
