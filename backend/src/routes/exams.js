import express from "express";
import db from "../db.js"
import {
	customJwtRequired,
	requireRoles,
	can_view_application,
	user_in_institution,
	ROLE_STUDENT,
	ROLE_REFERENT,
	ROLE_OVERSEAS
} from "../auth.js"
import { extractDbError } from "./api.js";
const api = express.Router();

// [GET] /api/exam/list/:id_institution
// returns the list of exam rows that belong to the given institution
api.get("/api/exam/list/:id_inst", customJwtRequired(), async (req, res) => {
	try {
		let exams = await db.any(`SELECT id,code,name,credits,id_institution FROM exams WHERE id_institution=$1`, [parseInt(req.params.id_inst, 10)]);
		res.status(200).json(exams);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [GET] /api/exam/:id
// returns the information of the exam row with the given id
api.get("/api/exam/:id", customJwtRequired(), async (req, res) => {
	try {
		let exam = await db.oneOrNone(`SELECT id,code,name,credits,id_institution FROM exams WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!exam) {
			return res.status(404).json({ error: "exam not found" });
		}
		res.status(200).json(exam);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [POST] /api/exam/insert
// inserts a new exam row using the json body data
api.post("/api/exam/insert", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		// validate user access by checking the institution to which the staff user belongs to
		if (!user_in_institution(req.currentUser, data.id_institution)) {
			return res.status(403).json({ status: "failed", error: "access restricted" });
		}

		await db.none(
			`INSERT INTO exams (code, name, credits, id_institution) VALUES ($1,$2,$3,$4)`,
			[data.code, data.name, data.credits, data.id_institution]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/exam/delete/:id
// deletes the exam row identified by :id
api.post("/api/exam/delete/:id", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		let exam = await db.oneOrNone(`SELECT * FROM exams WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!exam) {
			return res.status(404).json({ status: "failed", error: "exam not found" });
		}

		// check if staff belongs to the exam's institution
		if (!user_in_institution(req.currentUser, exam.id_institution)) {
			return res.status(403).json({ status: "failed", error: "access restricted" });
		}

		await db.none(`DELETE FROM exams WHERE id=$1`, [exam.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

//   -------  EXAM MAPPING SECTION  -------

// [POST] /api/exam/mapping/insert/:application_id
// inserts a new mapped_exams row linking a host exam and a sending exam for an application
api.post("/api/exam/mapping/insert/:application_id", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		const application_id = parseInt(req.params.application_id, 10);
		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		//	check application access
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot add a mapping to this application" });
		}

		// prevent adding exam mappings when associated application status is not adequate
		if (!["learning_agreement_pending", "created", "mobility_ongoing"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot add a mapping to this application in status ${application.status}` });
		}

		let notes = "";
		if ("notes" in data) {
			notes = data.notes;
		}
		// status='pending' and grade=-1 are defaults
		await db.none(
			`INSERT INTO mapped_exams (application_id, host_exam_id, sending_exam_id, notes, status, grade) VALUES ($1,$2,$3,$4,'pending',-1)`,
			[application_id, data.host_exam_id, data.sending_exam_id, notes]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/exam/mapping/delete/:id
// deletes the mapped_exams row identified by :id
api.post("/api/exam/mapping/delete/:id", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		let mapping = await db.oneOrNone(`SELECT * FROM mapped_exams WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!mapping) {
			return res.status(404).json({ status: "failed", error: "mapping not found" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [mapping.application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot remove a mapping to this application" });
		}

		// prevent exam deletion when application is not in adequate status
		if (!["learning_agreement_pending", "created", "mobility_ongoing"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot remove mapping from this application in status ${application.status}` });
		}

		await db.none(`DELETE FROM mapped_exams WHERE id=$1`, [mapping.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/exam/mapping/:id/decision
//	referent updates the status (and, if given, notes) of a mapped_exam row
api.post("/api/exam/mapping/:id/decision", customJwtRequired(), requireRoles(ROLE_REFERENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		let mapping = await db.oneOrNone(`SELECT * FROM mapped_exams WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!mapping) {
			return res.status(404).json({ status: "failed", error: "mapping not found" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [mapping.application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot decide on this exam" });
		}

		// prevent referent to make changes outside of allowed application status scope
		if (["pre_departure_completed", "closed"].includes(application.status)) {
			return res.status(403).json({ status: "failed", error: `cannot decide on this exam when associated application is in ${application.status}` });
		}

		if (application.status == "exam_recognition") {
			let doc = await db.oneOrNone(
				`SELECT * FROM uploaded_documents WHERE application_id=$1 AND document_type='transcript' AND status='approved' LIMIT 1`,
				[application.id]
			);
			if (!doc) {
				return res.status(404).json({ status: "failed", error: "approved transcript of records required" });
			}
		}

		if ("status" in data) {
			mapping.status = data.status;
		}
		if ("notes" in data) {
			mapping.notes = data.notes;
		}
		await db.none(
			`UPDATE mapped_exams SET status=$1, notes=$2, decision_date=NOW() WHERE id=$3`,
			[mapping.status, mapping.notes, mapping.id]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/exam/mapping/passed/:id
// registers grade and date_passed on the mapped_exam row of given id
api.post("/api/exam/mapping/passed/:id", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		let mapping = await db.oneOrNone(`SELECT * FROM mapped_exams WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!mapping) {
			return res.status(404).json({ status: "failed", error: "mapping not found" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [mapping.application_id]);
		if (!application) {
			return res.status(404).json({ status: "failed", error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ status: "failed", error: "cannot modify this application" });
		}

		// prevent exam grading outside of exam_recognition scope
		if (application.status != "exam_recognition") {
			return res.status(403).json({ status: "failed", error: `student cannot grade this exam when application is in ${application.status} status` });
		}

		// an approved exam is locked: its grade/date cannot be changed anymore
		if (mapping.status == "approved") {
			return res.status(403).json({ status: "failed", error: "approved exam cannot be modified" });
		}

		// grade/date can be entered only after the Transcript of Records is uploaded
		let transcript_exists = await db.oneOrNone(
			`SELECT * FROM uploaded_documents WHERE application_id=$1 AND document_type='transcript' LIMIT 1`,
			[application.id]
		);
		if (!transcript_exists) {
			return res.status(400).json({ status: "failed", error: "transcript of records not uploaded yet, please upload the transcript of records" });
		}

		if ("grade" in data) {
			mapping.grade = data.grade;
		}
		if ("date_passed" in data) {
			// null or an ISO-8601 date string, postgres casts it to a date
			mapping.date_passed = data.date_passed;
		}
		await db.none(
			`UPDATE mapped_exams SET grade=$1, date_passed=$2 WHERE id=$3`,
			[mapping.grade, mapping.date_passed, mapping.id]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [GET] /api/exam/mapped/info/status
// returns the list of allowed status values for mapped exams
api.get("/api/exam/mapped/info/status", (req, res) => {
	const statuses = ["pending", "approved", "rejected"];
	res.status(200).json(statuses);
})

const exams = api;
export default exams;
