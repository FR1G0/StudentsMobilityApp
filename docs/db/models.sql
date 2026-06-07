CREATE TABLE institutions (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	country VARCHAR(255) NOT NULL,
	city VARCHAR(255) NOT NULL
);

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	password_hash VARCHAR(255) NOT NULL,
	role VARCHAR(50) NOT NULL,
	firstname VARCHAR(255) NOT NULL,
	lastname VARCHAR(255) NOT null,
	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id)
);


CREATE TABLE applications (
	id SERIAL PRIMARY KEY,
	year INT NOT NULL,
	semester VARCHAR(20) NOT NULL,
	status VARCHAR(20) NOT NULL,
	date_submitted TIMESTAMP NOT NULL,
	sending_institution INT NOT NULL,
	FOREIGN KEY (sending_institution) REFERENCES institutions(id),
	host_institution INT NOT NULL,
	FOREIGN KEY (host_institution) REFERENCES institutions(id),
	user_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id)
);



CREATE TABLE exams (
	code VARCHAR(20) PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id),
	credits INT NOT NULL
);

CREATE TABLE mapped_exams (
	id SERIAL PRIMARY KEY,
	application_id INT NOT NULL,
	FOREIGN KEY (application_id) REFERENCES applications(id),
	exam_code VARCHAR(20) NOT NULL,
	FOREIGN KEY (exam_code) REFERENCES exams(code),
	mapped_exam_code VARCHAR(20) NOT NULL,
	FOREIGN KEY (mapped_exam_code) REFERENCES exams(code)
);

CREATE TABLE uploaded_documents (
	id SERIAL PRIMARY KEY,
	document_type VARCHAR(50) NOT NULL,
	file_path VARCHAR(255) NOT NULL,
	user_id INT NOT NULL,
	application_id INT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id),
	FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE partner_institution (
	id SERIAL PRIMARY KEY,

	/* foreign keys */
	id_institution INT NOT NULL,
	FOREIGN KEY (id_institution) REFERENCES institutions(id),
	id_partner_institution INT NOT NULL,
	FOREIGN KEY (id_partner_institution) REFERENCES institutions(id),

	/* constraints */
	CONSTRAINT self_partner CHECK (id_institution <> id_partner_institution) /* NO A->A */
)
