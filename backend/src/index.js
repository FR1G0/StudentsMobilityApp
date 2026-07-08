// index.js MAIN file
import express from "express";
import cors from "cors";
import db from "./db.js";
import users from "./routes/users.js"
import api from "./routes/api.js"
import applications from "./routes/applications.js"
import exams from "./routes/exams.js"
import institutions from "./routes/institutions.js"
import modifications from "./routes/modifications.js"

const app = express();
app.use(cors());
app.use(express.json());
app.use(users);
app.use(api);
app.use(applications);
app.use(exams);
app.use(institutions);
app.use(modifications);

const PORT = 5000;

app.get("/", (req,res) => {
	res.send("Welcome to the home page!");
});

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});

