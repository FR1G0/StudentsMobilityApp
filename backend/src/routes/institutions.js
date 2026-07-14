import express from "express";
import db from "../db.js"
import {
	customJwtRequired,
	requireRoles,
	user_in_institution,
	ROLE_OVERSEAS
} from "../auth.js"
import { extractDbError } from "./api.js";
const api = express.Router();

// [GET] /api/institutions
// returns the list of all institutions, accessible to everyone
api.get("/api/institutions", async (req, res) => {
	try {
		let institutions = await db.any(`SELECT id,name,country,city FROM institutions`);
		res.status(200).json(institutions);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [GET] /api/institution/info/:id
// returns information associated to the institution
api.get("/api/institution/info/:id", async (req, res) => {
	try {
		let inst = await db.oneOrNone(`SELECT id,name,country,city FROM institutions WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!inst) {
			return res.status(404).json({ status: "failed", error: "institution not found" });
		}

		res.status(200).json(inst);
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/institution/update/:id
// updates an existing institution row (staff only)
api.post("/api/institution/update/:id", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		const id = parseInt(req.params.id, 10);
		let inst = await db.oneOrNone(`SELECT * FROM institutions WHERE id=$1`, [id]);
		if (!inst) {
			return res.status(404).json({ status: "failed", error: "institution not found" });
		}

		if (!user_in_institution(req.currentUser, id)) {
			return res.status(403).json({ error: " access restricted" });
		}

		if ("name" in data) {
			inst.name = data.name;
		}
		if ("country" in data) {
			inst.country = data.country;
		}
		if ("city" in data) {
			inst.city = data.city;
		}

		await db.none(
			`UPDATE institutions SET name=$1, country=$2, city=$3 WHERE id=$4`,
			[inst.name, inst.country, inst.city, inst.id]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [GET] /api/institution/:id_institution/partners
// returns the list of partner institution mappings linked to the given institution
api.get("/api/institution/:id_institution/partners", customJwtRequired(), async (req, res) => {
	try {
		let rows = await db.any(
			`SELECT pi.id AS partner_row_id,
			        pi.id_partner_institution,
			        i.name AS partner_name,
			        i.country AS partner_country,
			        i.city AS partner_city
			 FROM partner_institution pi
			 JOIN institutions i ON i.id = pi.id_partner_institution
			 WHERE pi.id_institution = $1`,
			[parseInt(req.params.id_institution, 10)]
		);

		let result = [];
		for (const row of rows) {
			result.push({
				partner_row_id: row.partner_row_id,
				id_partner_institution: row.id_partner_institution,
				name: row.partner_name,
				country: row.partner_country,
				city: row.partner_city,
			});
		}
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [GET] /api/institution/:id/referents
// returns the list of referents (users with role=referent) associated to the institution
api.get("/api/institution/:id/referents", customJwtRequired(), async (req, res) => {
	try {
		let rows = await db.any(
			`SELECT u.id, u.email, u.firstname, u.lastname, u.role, u.id_institution
			 FROM users u
			 JOIN institutions i ON i.id = u.id_institution
			 WHERE i.id = $1 AND u.role = 'referent'`,
			[parseInt(req.params.id, 10)]
		);
		res.status(200).json(rows);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [GET] /api/institution/:id/students
// returns the list of students associated to the institution
api.get("/api/institution/:id/students", customJwtRequired(), async (req, res) => {
	try {
		let rows = await db.any(
			`SELECT u.id, u.email, u.firstname, u.lastname, u.role, u.id_institution
			 FROM users u
			 JOIN institutions i ON i.id = u.id_institution
			 WHERE i.id = $1 AND u.role = 'student'`,
			[parseInt(req.params.id, 10)]
		);
		res.status(200).json(rows);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [GET] /api/institution/:id/staff
// returns the list of staff members associated to the institution
api.get("/api/institution/:id/staff", customJwtRequired(), async (req, res) => {
	try {
		let rows = await db.any(
			`SELECT u.id, u.email, u.firstname, u.lastname, u.role, u.id_institution
			 FROM users u
			 JOIN institutions i ON i.id = u.id_institution
			 WHERE i.id = $1 AND u.role = 'staff'`,
			[parseInt(req.params.id, 10)]
		);
		res.status(200).json(rows);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [GET] /api/institution/:id/exams
// returns the list of exams associated to the institution
api.get("/api/institution/:id/exams", customJwtRequired(), async (req, res) => {
	try {
		let rows = await db.any(
			`SELECT e.id, e.code, e.name, e.credits, e.id_institution
			 FROM exams e
			 JOIN institutions i ON i.id = e.id_institution
			 WHERE i.id = $1`,
			[parseInt(req.params.id, 10)]
		);
		res.status(200).json(rows);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// [POST] /api/institution/partner/insert
// inserts a new partner_institution row to link two institutions
api.post("/api/institution/partner/insert", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		if (!user_in_institution(req.currentUser, data.id_institution)) {
			return res.status(403).json({ error: "staff member not authorized to add partnership" });
		}

		await db.none(
			`INSERT INTO partner_institution (id_institution, id_partner_institution) VALUES ($1,$2)`,
			[data.id_institution, data.id_partner_institution]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/institution/partner/:id/delete
// deletes a partner_institution mapping using the row id
api.post("/api/institution/partner/:id/delete", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		let partner = await db.oneOrNone(`SELECT * FROM partner_institution WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!partner) {
			return res.status(404).json({ status: "failed", error: "mapping not found" });
		}

		if (!user_in_institution(req.currentUser, partner.id_institution)) {
			return res.status(403).json({ error: "staff member not authorized to remove partnership" });
		}

		await db.none(`DELETE FROM partner_institution WHERE id=$1`, [partner.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// [POST] /api/institution/partner/:id/update
// updates an existing partner_institution mapping using the row id
// WARN: a bit weird to update a partnership, but NOT logically wrong, so let's keep it :).
api.post("/api/institution/partner/:id/update", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		let partner = await db.oneOrNone(`SELECT * FROM partner_institution WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!partner) {
			return res.status(404).json({ status: "failed", error: "mapping not found" });
		}

		if (!user_in_institution(req.currentUser, partner.id_institution)) {
			return res.status(403).json({ error: "staff member not authorized to update partnership" });
		}

		if ("id_institution" in data) {
			partner.id_institution = data.id_institution;
		}
		if ("id_partner_institution" in data) {
			partner.id_partner_institution = data.id_partner_institution;
		}

		await db.none(
			`UPDATE partner_institution SET id_institution=$1, id_partner_institution=$2 WHERE id=$3`,
			[partner.id_institution, partner.id_partner_institution, partner.id]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

const institutions = api;
export default institutions;
