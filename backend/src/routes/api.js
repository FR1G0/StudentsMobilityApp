import express from "express";
import db from "../db.js"
import { customJwtRequired } from "../auth.js"

const api = express.Router();

// checks the error and returns the message accordingly
export function extractDbError(error) {
	if (error && error.message) {
		return error.message;
	}
	return String(error);
}

// NOTE: [GET] /api/health
// returns the database status and the row counts of the main tables
api.get("/api/health", async (req, res) => {
	try {
		let result = await db.one(`
			SELECT
				current_database() AS database_name,
				version() AS database_version,
				(SELECT COUNT(*)::int FROM public.users) AS users_count,
				(SELECT COUNT(*)::int FROM public.institutions) AS institutions_count,
				(SELECT COUNT(*)::int FROM public.applications) AS applications_count,
				(SELECT COUNT(*)::int FROM public.exams) AS exams_count
		`);

		res.status(200).json({
			status: "ok",
			database_name: result.database_name,
			database_version: result.database_version,
			counts: {
				users: result.users_count,
				institutions: result.institutions_count,
				applications: result.applications_count,
				exams: result.exams_count,
			},
		});
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// NOTE: [GET] /api/summary
// returns global counts, the 5 most recent applications and the top 5 institutions
api.get("/api/summary", customJwtRequired(), async (req, res) => {
	try {
		let counts = await db.one(`
			SELECT
				(SELECT COUNT(*)::int FROM public.users) AS users_count,
				(SELECT COUNT(*)::int FROM public.institutions) AS institutions_count,
				(SELECT COUNT(*)::int FROM public.applications) AS applications_count,
				(SELECT COUNT(*)::int FROM public.exams) AS exams_count
		`);

		let recent_applications = await db.any(`
			SELECT
				a.id,
				a.year,
				a.semester,
				a.status,
				a.date_submitted,
				a.sending_institution,
				a.host_institution,
				a.user_id,
				CONCAT(u.firstname, ' ', u.lastname) AS student_name,
				si.name AS sending_institution_name,
				hi.name AS host_institution_name
			FROM public.applications a
			JOIN public.users u ON u.id = a.user_id
			JOIN public.institutions si ON si.id = a.sending_institution
			JOIN public.institutions hi ON hi.id = a.host_institution
			ORDER BY a.date_submitted DESC, a.id DESC
			LIMIT 5
		`);

		let top_institutions = await db.any(`
			SELECT
				i.id,
				i.name,
				i.country,
				i.city,
				COUNT(pi.id)::int AS partner_count
			FROM public.institutions i
			LEFT JOIN public.partner_institution pi ON pi.id_institution = i.id
			GROUP BY i.id, i.name, i.country, i.city
			ORDER BY partner_count DESC, i.name ASC
			LIMIT 5
		`);

		res.status(200).json({
			counts: {
				users: counts.users_count,
				institutions: counts.institutions_count,
				applications: counts.applications_count,
				exams: counts.exams_count,
			},
			recent_applications: recent_applications,
			top_institutions: top_institutions,
		});
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// NOTE: [GET] /api/exams
// returns the list of all exams joined with their institution
api.get("/api/exams", customJwtRequired(), async (req, res) => {
	try {
		let exams = await db.any(`
			SELECT
				e.code,
				e.name,
				e.credits,
				e.id_institution,
				i.name AS institution_name,
				i.country AS institution_country
			FROM public.exams e
			JOIN public.institutions i ON i.id = e.id_institution
			ORDER BY i.name ASC, e.name ASC
		`);
		res.status(200).json(exams);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

export default api;
