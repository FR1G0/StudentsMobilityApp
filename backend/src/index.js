// index.js MAIN file

const express = require('express')
const db = require('./db');

const app = express();
app.use(express.json());

const PORT = 3000;

app.get("/", (req,res) => {
	res.send("Welcome to the home page!");
});

app.listen(PORT, () => {
	console.log(`listening on port ${PORT}`);
});

