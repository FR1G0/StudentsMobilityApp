// index.js MAIN file
import express from "express";
import cors from "cors";
import db from "./db.js";
import users from "./routes/users.js"

const app = express();
app.use(express.json());
app.use(users);

const PORT = 5000;

app.get("/", (req,res) => {
	res.send("Welcome to the home page!");
});

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});

