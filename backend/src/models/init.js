const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

async function initDB() {
  const schema = fs.readFileSync(
    path.join(__dirname, "schema.sql"),
    "utf8"
  );

  await pool.query(schema);
}

module.exports = initDB;
