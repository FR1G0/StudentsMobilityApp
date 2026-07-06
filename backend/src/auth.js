import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "./db.js";

// Verifies werkzeug-format hashes: "pbkdf2:sha256:<iterations>$<salt>$<hexhash>"
export function checkPasswordHash(hashed_password, plaintext_password) {
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
    const derived = crypto.pbkdf2Sync(plaintext_password, salt, iterations, expected.length, algo);

    // Constant-time compare
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
}

export function normalizeRole(role) {
    if (!role) {
        return null;
    }
    return role.trim().toLowerCase().replaceAll(" ", "_");
}

//	get JWT Secret
export function getJwtSecret() {
    return process.env.JWT_SECRET || process.env.SECRET_KEY;
}

//	jwt check middleware
export function customJwtRequired() {
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
