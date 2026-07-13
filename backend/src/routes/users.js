// import jwt from "jsonwebtoken"; // replaced by manual implementation in auth.js (signJwt)
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { promisify } from "util";
import db from "../db.js"

const pbkdf2 = promisify(crypto.pbkdf2);
import {
	customJwtRequired,
	getJwtSecret,
	checkPasswordHash,
	requireRoles,
	user_in_institution,
	signJwt,
	ROLE_STUDENT,
	ROLE_REFERENT,
	ROLE_OVERSEAS
} from "../auth.js"
import { extractDbError } from "./api.js";
const api = express.Router();

// creates a werkzeug-format hash: "pbkdf2:sha256:<iterations>$<salt>$<hexhash>"
// NOTE: generatePasswordHash CANNOT be sync, that could literally freeze the db for 100ms+
async function generatePasswordHash(plaintext_password) {
	const iterations = 600000;
	const salt = crypto.randomBytes(8).toString("hex");
	const derived = await pbkdf2(plaintext_password, salt, iterations, 32, "sha256");
	return "pbkdf2:sha256:" + iterations + "$" + salt + "$" + derived.toString("hex");
}

// FIXED: now users can't just dump the all the users in the db.
// NOTE: [GET] /api/users to retrieve a list fo all users in the database
api.get("/api/users", customJwtRequired(), requireRoles(ROLE_OVERSEAS) , async (req,res) => {
	try {
    // FIXED: staff can only see own institution users
		let data = await db.any(`SELECT id,email,role,firstname,lastname,id_institution FROM users WHERE id_institution=$1`, [req.currentUser.id_institution]);
		res.status(200).json(data);
	} catch(error) {
		res.status(500).json({error: extractDbError(error)})
	}
})

// OK: [POST] /login
// authenticates a user and returns a JWT token along with the user info
api.post("/api/login", async (req, res) => {
    const data = req.body;
    if (!data || !data.email || !data.password) {
        return res.status(400).json({ error: "missing credentials" });
    }

    let user;
    try {
        user = await db.oneOrNone(`SELECT * FROM users WHERE email = $1`,[data.email]);
    } catch (err) {
        return res.status(500).json({ error: `database error ${err}`});
    }

    // password_hash stores a werkzeug hash (pbkdf2).
    if (!user || !(await checkPasswordHash(user.password_hash, data.password))) {
        return res.status(401).json({ error: "invalid credentials" });
    }

    const secret = getJwtSecret();
    if (!secret) {
        return res.status(500).json({ error: "JWT secret not configured" });
    }

    const payload = {
        sub: user.id,
        role: user.role,
    };
    // const token = jwt.sign(payload, secret, {
    //     algorithm: "HS256",
    //     expiresIn: "24h",
    // });
    const token = signJwt(payload, secret, 60 * 60 * 24); // 24h

    // strip sensitive fields — equivalent of user.to_dict()
	user.password_hash=null;

    return res.status(200).json({ token, user: user });
});

// OK: [GET] /user
// returns the list of all the users inside the same institution as the staff
api.get("/api/user", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		let staff_user = req.currentUser;
		let users = await db.any(`SELECT id,email,role,firstname,lastname,id_institution FROM users WHERE id_institution=$1`, [staff_user.id_institution]);
		res.status(200).json(users);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// OK: [GET] /user/:id
// returns the information of the row users using the users' id
api.get("/api/user/:id", customJwtRequired(), async (req, res) => {
	try {
		let user = await db.oneOrNone(`SELECT * FROM users WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!user) {
			return res.status(404).json({ error: "user not found" });
		}
		if (!user_in_institution(req.currentUser, user.id_institution)) {
			return res.status(403).json({ error: "access restricted" });
		}

		let result = {
			id: user.id,
			firstname: user.firstname,
			lastname: user.lastname,
			email: user.email,
			role: user.role,
			id_institution: user.id_institution,
		};
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: extractDbError(error) });
	}
})

// OK: [POST] /user/insert
// inserts a new user row into the database using the json body data
api.post("/api/user/insert", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data) {
			return res.status(400).json({ status: "failed", error: "missing body" });
		}

		if (!user_in_institution(req.currentUser, data.id_institution)) {
			return res.status(403).json({ status: "failed", error: "restricted access to this user" });
		}

		// accept "password" (preferred) or legacy "password_hash" as the raw secret
		const raw_password = data.password || data.password_hash;
		if (!raw_password) {
			return res.status(400).json({ status: "failed", error: "missing password" });
		}

		await db.none(
			`INSERT INTO users (email, password_hash, role, firstname, lastname, id_institution) VALUES ($1,$2,$3,$4,$5,$6)`,
			[data.email, await generatePasswordHash(raw_password), data.role, data.firstname, data.lastname, data.id_institution]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// OK: [POST] /user/update
// updates an existing user row using the json body data (must contain "id")
api.post("/api/user/update", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		const data = req.body;
		if (!data || !data.id) {
			return res.status(400).json({ status: "failed", error: "missing id" });
		}

		let user = await db.oneOrNone(`SELECT * FROM users WHERE id=$1`, [data.id]);
		if (!user) {
			return res.status(404).json({ status: "failed", error: "user not found" });
		}
		if (user.role == "staff") {
			return res.status(403).json({ status: "failed", error: "unauthorized access, higher privilege required for modifying staff rows" });
		}

		if (!user_in_institution(req.currentUser, user.id_institution)) {
			return res.status(403).json({ status: "failed", error: "restricted access to this user" });
		}

		if ("email" in data) {
			user.email = data.email;
		}
		if ("password" in data) {
			user.password_hash = await generatePasswordHash(data.password);
		} else if ("password_hash" in data) {
			user.password_hash = await generatePasswordHash(data.password_hash);
		}
		if ("firstname" in data) {
			user.firstname = data.firstname;
		}
		if ("lastname" in data) {
			user.lastname = data.lastname;
		}
		if ("id_institution" in data) {
			user.id_institution = data.id_institution;
		}

		await db.none(
			`UPDATE users SET email=$1, password_hash=$2, firstname=$3, lastname=$4, id_institution=$5 WHERE id=$6`,
			[user.email, user.password_hash, user.firstname, user.lastname, user.id_institution, user.id]
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

// OK: [POST] /user/delete/:id
// deletes the user row identified by :id
api.post("/api/user/delete/:id", customJwtRequired(), requireRoles(ROLE_OVERSEAS), async (req, res) => {
	try {
		let user = await db.oneOrNone(`SELECT * FROM users WHERE id=$1`, [parseInt(req.params.id, 10)]);
		if (!user) {
			return res.status(404).json({ status: "failed", error: "user not found" });
		}

		if (user.role == "staff") {
			return res.status(403).json({ status: "failed", error: "you can't delete staff members, higher authority required" });
		}

		if (!user_in_institution(req.currentUser, user.id_institution)) {
			return res.status(403).json({ status: "failed", error: "restricted access to this user" });
		}

		await db.none(`DELETE FROM users WHERE id=$1`, [user.id]);
		res.status(200).json({ status: "success" });
	} catch (error) {
		res.status(500).json({ status: "failed", error: extractDbError(error) });
	}
})

//   -------  USER INFO SECTION  -------

// OK: [GET] /user/info/role
// returns the list of allowed user roles
api.get("/api/user/info/role", (req, res) => {
	const roles = ["student", "referent", "staff"];
	res.status(200).json(roles);
})

const users = api;
export default users;
