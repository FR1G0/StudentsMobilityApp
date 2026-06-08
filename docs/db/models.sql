CREATE TABLE institutions (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	country VARCHAR(255) NOT NULL,
	city VARCHAR(255) NOT NULL
);

/* needs to be UPDATED */
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
		ON UPDATE CASCADE
);

CREATE TABLE applications (
	id SERIAL PRIMARY KEY,
	year INT NOT NULL,
	semester VARCHAR(20) NOT NULL,
	status VARCHAR(20) NOT NULL,
	date_submitted TIMESTAMPTZ NOT NULL,
	date_arrived DATE NOT NULL,
	date_departure DATE NOT NUll,
	notes TEXT default '',

	referent_id INT,
	FOREIGN KEY (referent_id) REFERENCES(users)
		/* if a referent gets deleted, must be managed */
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
	user_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE

	/* TODO: CONSTRAINTS: check if host institution is user id's institution*/
);


CREATE TABLE exams (
	id SERIAL PRIMARY KEY,
	code VARCHAR(20) NOT NULL,
	name VARCHAR(255) NOT NULL,
	/*TODO: can this be null? can an institution get deleted but keep the exam for exam mappings?*/
	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id)
		/* if an institution gets deleted, the mapped exams with other universities should be kept */
		ON DELETE RESTRICT 
		ON UPDATE CASCADE,
	credits INT NOT NULL
);

CREATE TABLE mapped_exams (
	id SERIAL PRIMARY KEY,
	application_id INT NOT NULL,
	/* grade=-1 means not passed*/
	grade int default -1,
	/* status can be: pending, rejected, approved */
	status VARCHAR(16) default 'pending',

	FOREIGN KEY (application_id) REFERENCES applications(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	exam_code VARCHAR(20) NOT NULL,
	FOREIGN KEY (exam_code) REFERENCES exams(code)
		ON DELETE RESTRICT 
		ON UPDATE CASCADE,
	mapped_exam_code VARCHAR(20) NOT NULL,
	FOREIGN KEY (mapped_exam_code) REFERENCES exams(code)
		ON DELETE RESTRICT
		ON UPDATE CASCADE
);

CREATE TABLE uploaded_documents (
	id SERIAL PRIMARY KEY,
	document_type VARCHAR(50) NOT NULL,
	file_path VARCHAR(255) NOT NULL,
	date_updated TIMESTAMPTZ NOT NULL,
	/* status can be: pending, rejected, approved */
	status VARCHAR(16) default 'pending',
	/* notes related to document rejection */
	notes TEXT DEFAULT '',

	user_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id)
		/* if a user gets removed all its documents should be removed */
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	application_id INT NOT NULL,
	FOREIGN KEY (application_id) REFERENCES applications(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
);

CREATE TABLE partner_institution (
	id SERIAL PRIMARY KEY,

	/* foreign keys */
	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	id_partner_institution INT NOT NULL,
	FOREIGN KEY (id_partner_institution) REFERENCES institutions(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,

	/* constraints */
	CONSTRAINT self_partner CHECK (id_institution <> id_partner_institution) /* NO A->A */
)
