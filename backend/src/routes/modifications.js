import express from "express";
import db from "../db.js"
import {
	customJwtRequired,
	requireRoles,
	can_view_application,
	ROLE_STUDENT,
	ROLE_REFERENT
} from "../auth.js"
import { extractDbError } from "./api.js";
const api = express.Router();

// NOTE: [POST] /application/:application_id/modification
// student proposes a Learning Agreement modification during mobility: the current
// exam mapping is snapshotted into la_modification_exams and replaced by the proposed
// one, all inside a single transaction. The updated LA must already be uploaded.
// WARN: the entire exam mapping of the application must be provided, even those not involved in the modification,
// this function snapshots all the current mappings, if mappings are partially provided, they will be lost upon rejection
api.post("/api/application/:application_id/modification", customJwtRequired(), requireRoles(ROLE_STUDENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ error: "missing body" });
		}

		const application_id = parseInt(req.params.application_id, 10);
		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [application_id]);
		if (!application) {
			return res.status(404).json({ error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ error: "not your application, access restricted" });
		}

		if (application.status != "mobility_ongoing") {
			return res.status(403).json({ error: "modifications allowed only during mobility" });
		}

		// only one open proposal at a time
		let pending = await db.oneOrNone(
			`SELECT * FROM la_modifications WHERE application_id=$1 AND status='pending' LIMIT 1`,
			[application_id]
		);
		if (pending) {
			return res.status(409).json({ error: "a pending modification already exists" });
		}

		const description = (data.description || "").trim();
		const document_id = data.document_id;
		const new_mapping = data.mapping;
		if (!description || !document_id || !new_mapping) {
			return res.status(400).json({ error: "description, document_id and mapping required" });
		}

		// check that the sent id learning agreeements are different:
		let alt_doc_id = await db.oneOrNone(
			`SELECT id FROM uploaded_documents WHERE application_id=$1 AND document_type='learning_agreement' AND id<>$2;`, 
			[application_id,document_id]
		); 
		if(!alt_doc_id) {
			return res.status(400).json({ error: "a new learning agreement is required" });
		}

		// the updated LA must belong to this application
		let doc = await db.oneOrNone(`SELECT * FROM uploaded_documents WHERE id=$1`, [document_id]);
		if (!doc || doc.application_id != application_id || doc.document_type != "learning_agreement") {
			return res.status(400).json({ error: "document_id must be a learning_agreement of this application" });
		}

		// ---- single transaction: create proposal, snapshot current, swap mapping ----
		const mod_id = await db.tx(async (t) => {
			// notes='' is a client-side ORM default in flask, the DB column has no default
			let mod = await t.one(
				`INSERT INTO la_modifications (application_id, description, document_id, status, notes)
				 VALUES ($1,$2,$3,'pending','') RETURNING id`,
				[application_id, description, document_id]
			);

			// snapshot the CURRENT mapping into the child table
			let current_mapping = await t.any(`SELECT * FROM mapped_exams WHERE application_id=$1`, [application_id]);
			for (const r of current_mapping) {
				await t.none(
					`INSERT INTO la_modification_exams (modification_id, host_exam_id, sending_exam_id, grade, date_passed, status, notes, decision_date)
					 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
					[mod.id, r.host_exam_id, r.sending_exam_id, r.grade, r.date_passed, r.status, r.notes, r.decision_date]
				);
			}

			// replace the live mapping (delete before insert: unique constraints)
			await t.none(`DELETE FROM mapped_exams WHERE application_id=$1`, [application_id]);
			for (const m of new_mapping) {
				let notes = "";
				if ("notes" in m) {
					notes = m.notes;
				}
				// status='pending' and grade=-1 are client-side ORM defaults in flask, the DB columns have no default
				await t.none(
					`INSERT INTO mapped_exams (application_id, host_exam_id, sending_exam_id, notes, status, grade) VALUES ($1,$2,$3,$4,'pending',-1)`,
					[application_id, m.host_exam_id, m.sending_exam_id, notes]
				);
			}

			return mod.id;
		});

		res.status(200).json({ status: "success", id: mod_id });
	} catch (error) {
		res.status(400).json({ error: extractDbError(error) });
	}
})

// NOTE: [GET] /application/:application_id/modifications
// returns the modification proposals of an application, each with its snapshot
api.get("/api/application/:application_id/modifications", customJwtRequired(), async (req, res) => {
	try {
		const application_id = parseInt(req.params.application_id, 10);
		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [application_id]);
		if (!application) {
			return res.status(404).json({ error: "application not found" });
		}
		if (!can_view_application(application, req.currentUser, req.currentUserRole)) {
			return res.status(403).json({ error: "not authorized" });
		}

		let mods = await db.any(
			`SELECT id, application_id, description, status, decision_date, notes, document_id
			 FROM la_modifications WHERE application_id=$1 AND status='pending'`,
			[application_id]
		);

		let result = [];
		for (const mod of mods) {
			let item = mod;
			item.snapshot = await db.any(
				`SELECT id, modification_id, host_exam_id, sending_exam_id, grade,
				        date_passed::text AS date_passed, status, notes, decision_date
				 FROM la_modification_exams WHERE modification_id=$1`,
				[mod.id]
			);
			result.push(item);
		}
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// NOTE: [POST] /modification/:id/decision
// the application's referent approves or rejects a modification. On reject the
// previous mapping is restored from the snapshot, atomically. decision_date is
// stamped by a DB trigger.
api.post("/api/modification/:id/decision", customJwtRequired(), requireRoles(ROLE_REFERENT), async (req, res) => {
	try {
		const data = req.body;
		if (!data || !("status" in data)) {
			return res.status(400).json({ error: "missing status" });
		}

		const new_status = data.status;
		if (new_status != "approved" && new_status != "rejected") {
			return res.status(400).json({ error: "status must be approved or rejected" });
		}

		let mod = await db.oneOrNone(`SELECT * FROM la_modifications WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!mod) {
			return res.status(404).json({ error: "modification not found" });
		}
		if (mod.status != "pending") {
			return res.status(409).json({ error: "modification already decided" });
		}

		let application = await db.oneOrNone(`SELECT * FROM applications WHERE id=$1`, [mod.application_id]);
		if (!application) {
			return res.status(404).json({ error: "application not found" });
		}

		if (application.referent_id != req.currentUserId) {
			return res.status(403).json({ error: "not the referent of this application" });
		}

		let notes = "";
		if ("notes" in data) {
			notes = data.notes;
		}
		if (new_status == "rejected" && !notes.trim()) {
			return res.status(400).json({ error: "rejection requires a motivation" });
		}

		// the previous learning agreement of the application (if any)
		let original_doc = await db.oneOrNone(
			`SELECT * FROM uploaded_documents
			 WHERE application_id=$1 AND id != $2 AND document_type='learning_agreement' LIMIT 1`,
			[mod.application_id, mod.document_id]
		);

		let mod_document = await db.oneOrNone(`SELECT * FROM uploaded_documents WHERE id=$1`, [mod.document_id]);
		if (new_status == "approved" && !mod_document) {
			return res.status(404).json({ error: "modified learning agreeement document not found" });
		}

		await db.tx(async (t) => {
			if (new_status == "rejected") {
				// ---- restore the previous mapping from the snapshot, atomically ----
				await t.none(`DELETE FROM mapped_exams WHERE application_id=$1`, [mod.application_id]);
				let snapshot = await t.any(`SELECT * FROM la_modification_exams WHERE modification_id=$1`, [mod.id]);
				for (const s of snapshot) {
					await t.none(
						`INSERT INTO mapped_exams (application_id, host_exam_id, sending_exam_id, grade, date_passed, status, notes, decision_date)
						 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
						[mod.application_id, s.host_exam_id, s.sending_exam_id, s.grade, s.date_passed, s.status, s.notes, s.decision_date]
					);
				}
				// --- restore the previous la through the deletion of the modification document_id
				if (original_doc != null) {
					await t.none(`DELETE FROM uploaded_documents WHERE id=$1`, [mod.document_id]);
				}
			}

			if (new_status == "approved") {
				await t.none(`UPDATE mapped_exams SET status='approved' WHERE application_id=$1`, [mod.application_id]);
				if (original_doc != null) {
					await t.none(`DELETE FROM uploaded_documents WHERE id=$1`, [original_doc.id]);
				}
				await t.none(`UPDATE uploaded_documents SET status='approved' WHERE id=$1`, [mod_document.id]);
			}

			// decision_date is going to be set by the set_modification_decision_date trigger
			await t.none(`UPDATE la_modifications SET status=$1, notes=$2 WHERE id=$3`, [new_status, notes, mod.id]);
		});

		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(400).json({ error: extractDbError(error) });
	}
})

const modifications = api;
export default modifications;
