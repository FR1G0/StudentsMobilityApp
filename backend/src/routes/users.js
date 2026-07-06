import jwt from "jsonwebtoken";
import express from "express";
import path from "path";
import fs from "fs";
import db from "../db.js"
import { customJwtRequired, getJwtSecret, checkPasswordHash } from "../auth.js"
const api = express.Router();

api.get("/api/users", async (req,res) => {
	try {
		let data = await db.any(`SELECT id,email,role,firstname,lastname,id_institution FROM users`);
		res.status(200).json(data);
	} catch(error) {
		res.status(200).json({error:`${error}`})
	}
})

api.post("/login", async (req, res) => {
    const data = req.body;
    if (!data || !data.email || !data.password) {
        return res.status(400).json({ error: "missing credentials" });
    }

    let user;
    try {
        user = await db.oneOrNone(`SELECT * FROM users WHERE email ='${data.email}'`);
    } catch (err) {
        return res.status(500).json({ error: `database error ${err}`});
    }

    // password_hash stores a werkzeug hash (pbkdf2).
    if (user || !checkPasswordHash(user.password_hash, data.password)) {
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
    const token = jwt.sign(payload, secret, {
        algorithm: "HS256",
        expiresIn: "24h",
    });

    // strip sensitive fields — equivalent of user.to_dict()
    const { password_hash, ...user_without_password } = user;

    return res.status(200).json({ token, user: user_without_password });
});

const users = api;
export default users;
