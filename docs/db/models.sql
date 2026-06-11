CREATE TABLE institutions (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	country VARCHAR(255) NOT NULL,
	city VARCHAR(255) NOT NULL
);

-- needs to be UPDATED 
CREATE TABLE users ( 
	id SERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	password_hash VARCHAR(255) NOT NULL,
	role VARCHAR(50) NOT NULL,
	firstname VARCHAR(255) NOT NULL,
	lastname VARCHAR(255) NOT null,
	id_institution INT NOT NULL,

	FOREIGN KEY (id_institution) REFERENCES institutions(id) 
		ON DELETE RESTRICT
		ON UPDATE CASCADE,

	CONSTRAINT allowed_user_roles CHECK (role='student' or role='referent' or role='staff'),
	-- for applications fk
	UNIQUE (id, id_institution)
);

CREATE TABLE applications (
	id SERIAL PRIMARY KEY,
	year INT NOT NULL,
	semester VARCHAR(50) NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'created',
	date_submitted TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

	date_arrived DATE,
	date_departure DATE,
	notes TEXT default '',

	referent_id INT,
	FOREIGN KEY (referent_id) REFERENCES users(id)
		-- if a referent gets deleted, must be managed 
		ON DELETE SET NULL
		ON UPDATE CASCADE,

	sending_institution INT NOT NULL,
	FOREIGN KEY (sending_institution) REFERENCES institutions(id)
		ON DELETE RESTRICT
		ON UPDATE CASCADE,
	host_institution INT NOT NULL,
	FOREIGN KEY (host_institution) REFERENCES institutions(id)
		ON DELETE RESTRICT
		ON UPDATE CASCADE,
	
	-- make sure that it's the user's actual institution
	FOREIGN KEY (user_id, sending_institution) REFERENCES users(id,id_institution),

	user_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,

	

	CONSTRAINT different_host_sending CHECK (host_institution <> sending_institution),
	CONSTRAINT valid_mobility_dates CHECK (
		date_arrived IS NULL OR date_departure IS NULL
		OR date_departure >= date_arrived
	),
	CONSTRAINT valid_semester CHECK (semester IN ('first','second','full')),
	CONSTRAINT valid_status CHECK (status IN (
		'created',
		'learning_agreement_pending',
		'pre_departure_completed',
		'mobility_ongoing',
		'exam_recognition',
		'closed'
	))
	-- TODO: CONSTRAINTS: check if host institution is user id's institution
);


CREATE TABLE exams (
	id SERIAL PRIMARY KEY,
	code VARCHAR(50) NOT NULL,
	name VARCHAR(255) NOT NULL,
	credits INT NOT NULL,
	-- TODO: can this be null? can an institution get deleted but keep the exam for exam mappings?



	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id)
		-- if an institution gets deleted, the mapped exams with other universities should be kept 
		ON DELETE RESTRICT 
		ON UPDATE CASCADE,

	UNIQUE (code, id_institution)
);

CREATE TABLE mapped_exams (
	id SERIAL PRIMARY KEY,
	application_id INT NOT NULL,
	date_passed DATE,
	-- grade=-1 means not passed
	grade int default -1,
	-- status can be: pending, rejected, approved 
	status VARCHAR(32) NOT NULL default 'pending',

	-- referent can reject a specific mapping
	decision_date TIMESTAMPTZ,
	notes TEXT DEFAULT '',
	-- pervious_id to restore old mapping if *this* mapping gets rejected 
	previous_id INT NOT NULL default -1,

	FOREIGN KEY (application_id) REFERENCES applications(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	host_exam_id INT NOT NULL,
	FOREIGN KEY (host_exam_id) REFERENCES exams(id)
		ON DELETE RESTRICT 
		ON UPDATE CASCADE,
	sending_exam_id INT NOT NULL,
	FOREIGN KEY (sending_exam_id) REFERENCES exams(id)
		ON DELETE RESTRICT
		ON UPDATE CASCADE,
	-- TODO: TRIGGER make sure the exams belong to the correct institutions
	
	CONSTRAINT valid_status CHECK (status in ('pending','approved','rejected')),
	CONSTRAINT valid_grade CHECK (grade =-1 OR (grade > 17 AND grade <= 30)),
	CONSTRAINT valid_grade_date CHECK (
		(grade=-1 AND date_passed IS NULL)
		OR (grade <> -1 AND date_passed IS NOT NULL)
	),
	-- TODO: enforce host_exam_id.id_institution = application.host_institution
    -- TODO: enforce sending_exam_id.id_institution = application.sending_institution
	UNIQUE (application_id,host_exam_id,sending_exam_id)
);

CREATE TABLE uploaded_documents (
	id SERIAL PRIMARY KEY,
	document_type VARCHAR(50) NOT NULL,
	file_path VARCHAR(255) NOT NULL,
	date_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	status VARCHAR(32) NOT NULL default 'pending',
	-- notes related to document rejection (which is a decision) 
	decision_date TIMESTAMPTZ,
	notes TEXT DEFAULT '',

	user_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id)
		-- if a user gets removed all its documents should be removed 
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	application_id INT NOT NULL,
	FOREIGN KEY (application_id) REFERENCES applications(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	
	CONSTRAINT valid_type CHECK(document_type IN ('learning_agreement','transcript')),
	CONSTRAINT valid_status CHECK(status IN ('pending','approved','rejected'))
);

CREATE TABLE partner_institution (
	id SERIAL PRIMARY KEY,

	-- foreign keys 
	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	id_partner_institution INT NOT NULL,
	FOREIGN KEY (id_partner_institution) REFERENCES institutions(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,

	-- NO A->A 
	CONSTRAINT self_partner CHECK (id_institution <> id_partner_institution), 
	UNIQUE (id_institution,id_partner_institution)
)
