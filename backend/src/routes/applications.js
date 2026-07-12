import express from "express";
import path from "path";
import fs from "fs/promises";
import multer from "multer";
import { fileURLToPath } from "url";
import db from "../db.js"
import {
	customJwtRequired,
	requireRoles,
	can_view_application,
	ROLE_STUDENT,
	ROLE_REFERENT,
	ROLE_OVERSEAS
} from "../auth.js"
import { extractDbError } from "./api.js";
const api = express.Router();

// file is kept in memory until the access checks pass, then written to disk
const upload = multer({ storage: multer.memoryStorage() });

const UPLOADS_BASE_DIR = path.join(
	path.dirname(path.dirname(fileURLToPath(import.meta.url))),
	"uploads",
	"applications"
);

function applicationUploadDir(application_id) {
	return path.join(UPLOADS_BASE_DIR, String(application_id));
}

// async existence check (fs/promises has no existsSync)
async function pathExists(p) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

// same columns as Application.to_dict(), date columns casted to text
const APPLICATION_COLUMNS = `id, year, semester, status, date_submitted,
	date_arrived::text AS date_arrived, date_departure::text AS date_departure,
	notes, referent_id, sending_institution, host_institution, user_id`;

// OK: [GET] /applications
// returns the list of applications visible to the current user based on role
api.get("/api/applications", customJwtRequired(), async (req, res) => {
	try {
		const user = req.currentUser;
		const role = req.currentUserRole;
		let applications;
		if (role == ROLE_STUDENT) {
			applications = await db.any(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE user_id=$1`, [user.id]);
		} else if (role == ROLE_REFERENT) {
			applications = await db.any(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE referent_id=$1`, [user.id]);
		} else if (role == ROLE_OVERSEAS) {
			applications = await db.any(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE sending_institution=$1`, [user.id_institution]);
		} else {
			return res.status(403).json({ error: "role not authorized" });
		}
		res.status(200).json(applications);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// TEST: [POST] /application/insert
// creates a new application row (student only) and prepares its uploads directory
api.post("/api/application/insert", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		let status = "created";
		if ("status" in data) {
			status = data.status;
		}
		let notes = "";
		if ("notes" in data) {
			notes = data.notes;
		}

		let new_app = await db.one(
			`INSERT INTO applications (year, semester, status, notes, referent_id, sending_institution, host_institution, user_id)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
			[data.year, data.semester, status, notes, data.referent_id, data.sending_institution, data.host_institution, req.currentUserId]
		);

		const upload_dir = applicationUploadDir(new_app.id);
		await fs.mkdir(upload_dir, { recursive: true });

		res.status(200).json({ status: "success", id: new_app.id });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// PASSED: [POST] /application/update/:id
// updates the editable fields of an application (student, own application only).
// status is intentionally excluded: it has its own workflow route.
api.post("/api/application/update/:id", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}

		// a student may only edit their own application
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "access restricted, cannot modify this application" });
		}

		// changes to application may only be done if application status is adequate
		if (["pre_departure_completed", "closed"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot modify this application while it's in ${application.status} status` });
		}

		// only these fields may be changed here; reject anything else
		let allowed_fields = [
			"year",
			"semester",
			"notes",
			"referent_id",
			"sending_institution",
			"host_institution",
			"date_arrived",
			"date_departure",
		];

		// restrict institution and referent changes
		if (application.status == "mobility_ongoing") {
			allowed_fields = [
				"notes",
				"date_arrived",
				"date_departure",
			];
		}

		const unknown_fields = Object.keys(data).filter((field) => !allowed_fields.includes(field));
		if (unknown_fields.length > 0) {
			return res.status(400).json({
				status: "failed",
				error: "unknown fields: " + unknown_fields.sort().join(", "),
			});
		}

		const integer_fields = ["year", "referent_id", "sending_institution", "host_institution"];
		const date_fields = ["date_arrived", "date_departure"];

		for (const field of Object.keys(data)) {
			const value = data[field];
			if (integer_fields.includes(field)) {
				if (!Number.isInteger(value)) {
					return res.status(400).json({ status: "failed", error: field + " must be an integer" });
				}
				application[field] = value;
			} else if (date_fields.includes(field)) {
				if (value === null) {
					application[field] = null;
				} else {
					const parsed_date = new Date(value);
					if (Number.isNaN(parsed_date.getTime())) {
						return res.status(400).json({
							status: "failed",
							error: field + " must be an ISO-8601 date",
						});
					}
					// postgres casts the ISO string to a date
					application[field] = value;
				}
			} else {
				application[field] = value;
			}
		}

		try {
			await db.none(
				`UPDATE applications SET year=$1, semester=$2, notes=$3, referent_id=$4,
				 sending_institution=$5, host_institution=$6, date_arrived=$7, date_departure=$8 WHERE id=$9`,
				[application.year, application.semester, application.notes, application.referent_id,
				 application.sending_institution, application.host_institution,
				 application.date_arrived, application.date_departure, application.id]
			);
		} catch (error) {
			// DB triggers/constraints enforce workflow rules; surface them as a 400
			return res.status(400).json({ status: "failed", error: extractDbError(error) });
		}

		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// NOTE: [POST] /application/status/update/:id
// updates the application status, following a very specific workflow
api.post("/api/application/status/update/:id", customJwtRequired(), requireRoles(ROLE_STUDENT, ROLE_REFERENT, ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		// this route only moves the status, so it must always be present
		if (!("status" in data)) {
			return res.status(400).json({ status: "failed", error: "missing status" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}

		const role = req.currentUserRole;
		if (!can_view_application(application, req.currentUser, role)) {
			return res.status(403).json({ status: "failed", error: "cannot modify this application" });
		}

		if (role == ROLE_STUDENT) {
			if (!["mobility_ongoing", "exam_recognition"].includes(data.status)) {
				return res.status(403).json({ status: "failed", error: "student cannot set this status" });
			}
		}

		// check referent
		if (role == ROLE_REFERENT) {
			const referent_allowed_fields = ["status", "notes"];
			const extra_fields = Object.keys(data).filter((field) => !referent_allowed_fields.includes(field));
			if (extra_fields.length > 0) {
				return res.status(403).json({ status: "failed", error: "referent can only change status" });
			}
			if (!["created", "learning_agreement_pending"].includes(data.status)) {
				return res.status(403).json({ status: "failed", error: "referent cannot set this status" });
			}
		}

		// check staff
		if (role == ROLE_OVERSEAS) {
			const overseas_allowed_fields = ["status"];
			const extra_fields = Object.keys(data).filter((field) => !overseas_allowed_fields.includes(field));
			if (extra_fields.length > 0) {
				return res.status(403).json({ status: "failed", error: "staff can only change status" });
			}
			if (!["pre_departure_completed", "closed"].includes(data.status)) {
				return res.status(403).json({ status: "failed", error: "staff cannot set this status" });
			}
		}

		application.status = data.status;

		if ("notes" in data) {
			application.notes = data.notes;
		}
		await db.none(`UPDATE applications SET status=$1, notes=$2 WHERE id=$3`, [application.status, application.notes, application.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// PASSED: [POST] /application/delete/:id
// deletes the application row identified by :id (student and staff only), both student and staff can delete applications
api.post("/api/application/delete/:id", customJwtRequired(), requireRoles(ROLE_STUDENT, ROLE_OVERSEAS), async (req, res) => {
	try {
		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!["learning_agreement_pending", "created"].includes(application.status) && req.currentUserRole == ROLE_STUDENT) {
			return res.status(403).json({ status: "failed", error: `student cannot delete a ${application.status} application` });
		}

		// students delete only their own; staff only apps hosted by their institution
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot delete this application" });
		}

		await db.none(`DELETE FROM applications WHERE id=$1`, [application.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

//   -------  APPLICATION INFORMATION SECTION  -------

// PASSED: [GET] /applications/info/list
// returns the list of applications visible to the current user (same role
// scoping as /applications) together with their sending/host institutions,
// the owner student and the referent (joined data), in json format
api.get("/api/applications/info/list", customJwtRequired(), async (req, res) => {
	try {
		const user = req.currentUser;
		const role = req.currentUserRole;
		let applications;
		if (role == ROLE_STUDENT) {
			applications = await db.any(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE user_id=$1`, [user.id]);
		} else if (role == ROLE_REFERENT) {
			applications = await db.any(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE referent_id=$1`, [user.id]);
		} else if (role == ROLE_OVERSEAS) {
			applications = await db.any(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE sending_institution=$1`, [user.id_institution]);
		} else {
			return res.status(403).json({ error: "role not authorized" });
		}

		// batch-fetch related rows to avoid one query per application
		let institution_ids = [];
		let user_ids = [];
		for (const a of applications) {
			if (!institution_ids.includes(a.sending_institution)) {
				institution_ids.push(a.sending_institution);
			}
			if (!institution_ids.includes(a.host_institution)) {
				institution_ids.push(a.host_institution);
			}
			if (!user_ids.includes(a.user_id)) {
				user_ids.push(a.user_id);
			}
			if (a.referent_id !== null && !user_ids.includes(a.referent_id)) {
				user_ids.push(a.referent_id);
			}
		}

		let institution_rows = [];
		if (institution_ids.length > 0) {
			institution_rows = await db.any(`SELECT id,name,country,city FROM institutions WHERE id IN ($1:csv)`, [institution_ids]);
		}
		let user_rows = [];
		if (user_ids.length > 0) {
			user_rows = await db.any(`SELECT id,email,firstname,lastname FROM users WHERE id IN ($1:csv)`, [user_ids]);
		}

		let institutions = {};
		for (const row of institution_rows) {
			institutions[row.id] = row;
		}
		let users = {};
		for (const row of user_rows) {
			users[row.id] = row;
		}

		let result = [];
		for (const application of applications) {
			const sending = institutions[application.sending_institution];
			const host = institutions[application.host_institution];
			const owner = users[application.user_id];
			const referent = users[application.referent_id];

			let item = application;
			item.sending = sending ? { id: sending.id, name: sending.name } : null;
			item.host = host ? { id: host.id, name: host.name } : null;
			item.user = owner ? {
				id: owner.id,
				firstname: owner.firstname,
				lastname: owner.lastname,
				email: owner.email,
			} : null;
			item.referent = referent ? {
				id: referent.id,
				firstname: referent.firstname,
				lastname: referent.lastname,
				email: referent.email,
			} : null;
			result.push(item);
		}
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// PASSED: [GET] /application/info/semester
// returns the list of allowed semester values
// for frontend
api.get("/api/application/info/semester", (req, res) => {
	const semesters = ["first", "second", "full"];
	res.status(200).json(semesters);
})

// OK: [GET] /application/info/status
// returns the list of allowed application status values, for frontend
api.get("/api/application/info/status", (req, res) => {
	const statuses = [
		"created",
		"learning_agreement_pending",
		"pre_departure_completed",
		"mobility_ongoing",
		"exam_recognition",
		"closed",
	];
	res.status(200).json(statuses);
})

// OK: [GET] /application/info/academic_years, for frontend
// returns the list of academic years starting from the current year for 5 years
api.get("/api/application/info/academic_years", (req, res) => {
	const current_year = new Date().getFullYear();
	let years = [];
	let i = 0;
	while (i < 5) {
		years.push(current_year + i);
		i = i + 1;
	}
	res.status(200).json(years);
})

//   -------  DOCUMENT SECTION  -------

// TEST: [POST] /application/documents/:id
// returns the list of all uploaded documents associated to the given application
api.post("/api/application/documents/:id", customJwtRequired(), async (req, res) => {
	try {
		const id = parseInt(req.params.id, 10);
		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [id]);
		if (!application) {
			return res.status(404).json({ error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ error: "not authorized for this application" });
		}

		let documents = await db.any(
			`SELECT id, document_type, file_path, date_updated, status, decision_date, notes, user_id, application_id
			 FROM uploaded_documents WHERE application_id=$1`,
			[id]
		);
		res.status(200).json(documents);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// OK: [POST] /application/document/insert
// inserts a new uploaded_document **row only** using the json body data
// FIXED: file_path is sanitized to basename on insert; delete/download resolve
// against the owning application's upload dir instead of trusting the stored path
// this probably happens elsewhere in the code also, need to fix.
api.post("/api/application/document/insert", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [data.application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot upload to this application" });
		}

		if (data.document_type == "learning_agreement" && !["learning_agreement_pending", "created", "mobility_ongoing"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot upload learning agreement when application is in ${application.status}` });
		}

		if (data.document_type == "transcript" && application.status != "exam_recognition") {
			return res.status(403).json({ status: "failed", error: `cannot upload transcript of records when application is in ${application.status}` });
		}

		let notes = "";
		if ("notes" in data) {
			notes = data.notes;
		}
		// store only the filename, never a client-controlled path (prevents arbitrary
		// file delete/read via file_path in the delete/download routes)
		const safe_file_path = path.basename(data.file_path || "");
		if (!safe_file_path) {
			return res.status(400).json({ status: "failed", error: "missing or invalid file_path" });
		}
		// status='pending' is a client-side ORM default in flask, the DB column has no default
		let new_doc = await db.one(
			`INSERT INTO uploaded_documents (document_type, file_path, user_id, application_id, notes, status)
			 VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
			[data.document_type, safe_file_path, req.currentUserId, data.application_id, notes]
		);
		res.status(200).json({ status: "success", id: new_doc.id });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// OK: [POST] /application/document/upload
// uploads a file from form-data ("myfile") into uploads/applications/:application_id/
api.post("/api/application/document/upload", customJwtRequired(), requireRoles(ROLE_STUDENT), upload.single("myfile"), async (req, res) => {
	try {
		const application_id = req.body.application_id;
		if (!application_id) {
			return res.status(400).json({ status: "failed", error: "missing application_id" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot upload to this application" });
		}

		if (["pre_departure_completed", "closed"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot upload to this application when it's in status ${application.status}` });
		}

		const uploaded_file = req.file;
		if (!uploaded_file || uploaded_file.originalname == "") {
			return res.status(400).json({ status: "failed", error: "missing file" });
		}

		const upload_dir = applicationUploadDir(application_id);
		await fs.mkdir(upload_dir, { recursive: true });

		const filename = path.basename(uploaded_file.originalname);
		const destination = path.join(upload_dir, filename);
		await fs.writeFile(destination, uploaded_file.buffer);

		res.status(200).json({ status: "success", file_path: destination });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// OK: [POST] /application/document/:id/delete
// deletes the uploaded file from disk and removes the related document row
api.post("/api/application/document/:id/delete", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		let doc = await db.oneOrNone(`SELECT * FROM uploaded_documents WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!doc) {
			return res.status(404).json({ status: "failed", error: "document not found" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [doc.application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot delete this document" });
		}

		// prevent document deletion when associated application is in a non adequate status
		if (!["learning_agreement_pending", "created", "mobility_ongoing"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot delete this document when application is in ${application.status}` });
		}

		// always resolve against the owning application's upload dir; never trust the
		// stored file_path as a real path (basename strips any directory/traversal)
		const target = path.join(applicationUploadDir(doc.application_id), path.basename(doc.file_path || ""));
		try {
			await fs.unlink(target);
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}

		await db.none(`DELETE FROM uploaded_documents WHERE id=$1`, [doc.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// OK: [GET] /application/document/:id/download
// sends the uploaded file back so the frontend can download it, allows anyone that has access to that application to download/view the documents
api.get("/api/application/document/:id/download", customJwtRequired(), async (req, res) => {
	try {
		let doc = await db.oneOrNone(`SELECT * FROM uploaded_documents WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!doc) {
			return res.status(404).json({ error: "document not found" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [doc.application_id]);
		if (!application) {
			return res.status(404).json({ error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ error: "not authorized for this document" });
		}

		// always resolve against the owning application's upload dir; never serve the
		// stored file_path as a real path (basename strips any directory/traversal)
		const file_path = path.join(applicationUploadDir(doc.application_id), path.basename(doc.file_path || ""));
		if (!(await pathExists(file_path))) {
			return res.status(404).json({ error: "file not found" });
		}

		res.download(file_path, path.basename(file_path));
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// OK: [POST] /application/document/:id/decision
// referent approves or rejects an uploaded document (learning agreement / transcript),
// recording a motivation; decision_date is stamped by a DB trigger
api.post("/api/application/document/:id/decision", customJwtRequired(), requireRoles(ROLE_REFERENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data || !("status" in data)) {
			return res.status(400).json({ status: "failed", error: "missing status" });
		}

		const new_status = data.status;
		if (new_status != "approved" && new_status != "rejected") {
			return res.status(400).json({
				status: "failed",
				error: "document status must be approved or rejected",
			});
		}

		let doc = await db.oneOrNone(`SELECT * FROM uploaded_documents WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!doc) {
			return res.status(404).json({ status: "failed", error: "document not found" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [doc.application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "restricted access for this application" });
		}

		let notes = "";
		if ("notes" in data) {
			notes = data.notes;
		}
		// a rejection must carry a motivation
		if (new_status == "rejected" && !(notes && notes.trim())) {
			return res.status(400).json({ status: "failed", error: "rejection requires a motivation" });
		}

		// decision_date is set by the set_document_decision_date trigger
		await db.none(`UPDATE uploaded_documents SET status=$1, notes=$2 WHERE id=$3`, [new_status, notes, doc.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(400).json({ status: "failed", error: extractDbError(error) });
	}
})

// OK: [GET] /application/exams_mapping/:application_id
// returns the list of mapped_exams rows associated to the given application, anyone with access to the application can view the associated exam mappings.
api.get("/api/application/exams_mapping/:application_id", customJwtRequired(), async (req, res) => {
	try {
		const application_id = parseInt(req.params.application_id, 10);
		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [application_id]);
		if (!application) {
			return res.status(404).json({ error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ error: `${req.currentUserRole} user not authorized for this application` });
		}

		let mappings = await db.any(
			`SELECT id, application_id, date_passed::text AS date_passed, grade, status, decision_date, notes, host_exam_id, sending_exam_id
			 FROM mapped_exams WHERE application_id=$1`,
			[application_id]
		);
		res.status(200).json(mappings);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

//   -------  DOCUMENT INFORMATION SECTION  -------

// OK: [GET] /application/document/info/type
// returns the list of allowed document types, for frontend
api.get("/api/application/document/info/type", (req, res) => {
	const types = ["learning_agreement", "transcript"];
	res.status(200).json(types);
})

// OK: [GET] /application/document/info/status
// returns the list of allowed document status values
api.get("/api/application/document/info/status", (req, res) => {
	const statuses = ["pending", "approved", "rejected"];
	res.status(200).json(statuses);
})

const applications = api;
export default applications;
