import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db/client";

const schemaPath = path.join(process.cwd(), "lib/db/schema.sql");
const sql = fs.readFileSync(schemaPath, "utf-8");

const database = db();
database.exec(sql);

console.log(`Initialized database at ${process.env.DATABASE_PATH || "./data/product-advisor.db"}`);
