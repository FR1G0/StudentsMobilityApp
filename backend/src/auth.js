import jwt from "jsonwebtoken";
import crypto from "crypto";
import { promisify } from "util";
import db from "./db.js";

const pbkdf2 = promisify(crypto.pbkdf2);

export const ROLE_STUDENT = "student"
export const ROLE_REFERENT = "referent"
export const ROLE_OVERSEAS = "staff"

// Verifies werkzeug-format hashes: "pbkdf2:sha256:<iterations>$<salt>$<hexhash>"
export async function checkPasswordHash(hashed_password, plaintext_password) {
    if (!hashed_password || typeof hashed_password !== "string") return false;
    const [method, salt, hashHex] = hashed_password.split("$");
    if (!method || !salt || !hashHex) return false;

	// ["pbkdf2", "sha256", "<iterations>"] 
    const parts = method.split(":");

    if (parts[0] !== "pbkdf2") return false;
    const algo = parts[1];
    const iterations = parseInt(parts[2], 10);
    if (!algo || Number.isNaN(iterations)) return false;

    const expected = Buffer.from(hashHex, "hex");
    const derived = await pbkdf2(plaintext_password, salt, iterations, expected.length, algo);

    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
}

//	expects an array of roles
export function requireRoles(...allowed) {
    const allowedRoles = new Set(allowed.map(normalizeRole));
    return function (req, res, next) {
        const role = req.currentUserRole ?? null;
        if (role === null) {
            return res.status(401).json({ error: "authentication required" });
        }
        if (!allowedRoles.has(role)) {
            return res.status(403).json({ error: "role not authorized" });
        }
        return next();
    };
}

//	expects userObject as json user and id_institution as a number
export function user_in_institution(user, id_institution) {
	if(!user.id_institution || !id_institution)
		return false;
	return user.id_institution == id_institution;
}

export function can_view_application(application, user, role) {
	if(!application.user_id || !user.id)
		return false;
	if(normalizeRole(role)==ROLE_STUDENT) {
		return application.user_id == user.id;
	}
	if(normalizeRole(role)==ROLE_REFERENT) {
		return application.referent_id == user.id;
	}
	if(normalizeRole(role)==ROLE_OVERSEAS) {
		return application.sending_institution == user.id_institution;
	}
	return false;
}

//	expects role as a string "student"
export function normalizeRole(role) {
    if (!role) { return null; }
    return role.trim().toLowerCase().replaceAll(" ", "_");
}


//	get JWT Secret
export function getJwtSecret() {
    return process.env.JWT_SECRET || process.env.SECRET_KEY;
}


//	jwt check middleware
export function customJwtRequired(roles) {
    return async function (req, res, next) {

        const authHeader = req.headers["authorization"] || "";
        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "missing bearer token" });
        }
        const token = authHeader.split(" ", 2)[1].trim();

        const secret = getJwtSecret();
        if (!secret) {
            return res.status(500).json({ error: "JWT secret not configured" });
        }

        let payload;
        try {
            payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ error: "token expired" });
            }
            return res.status(401).json({ error: "invalid token" });
        }

        let userId = payload.sub;
        userId = parseInt(userId, 10);
        if (Number.isNaN(userId)) {
            return res.status(401).json({ error: "token user id invalid" });
        }

        let user;
        try {
            user = await db.oneOrNone("SELECT * FROM users WHERE id = $1", [userId]);
        } catch (err) {
            return res.status(500).json({ error: "database error" });
        }
        if (!user) {
            return res.status(401).json({ error: "user not found" });
        }

        // Express has no `g`; attach to req instead (per-request scope)
        req.currentUser = user;
        req.currentUserId = user.id;
        req.currentUserRole = normalizeRole(user.role);
        req.jwtPayload = payload;

        return next();
    };
}
