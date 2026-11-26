"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "party.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS votes (
    voter_id TEXT PRIMARY KEY,
    team TEXT NOT NULL CHECK (team IN ('boy', 'girl')),
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rsvps (
    device_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    attendance TEXT NOT NULL CHECK (attendance IN ('yes', 'no')),
    created_at INTEGER NOT NULL
  );
`);

function readPoll() {
  const votes = db
    .prepare(
      `SELECT voter_id AS id, team, created_at AS at
       FROM votes
       ORDER BY created_at ASC`
    )
    .all();
  const boy = votes.filter((v) => v.team === "boy").length;
  const girl = votes.filter((v) => v.team === "girl").length;
  return { votes, boy, girl, total: boy + girl };
}

function readRsvps() {
  const rsvps = db
    .prepare(
      `SELECT device_id AS deviceId, name, attendance, created_at AS at
       FROM rsvps
       ORDER BY created_at ASC`
    )
    .all();
  const yes = rsvps.filter((r) => r.attendance === "yes").length;
  const no = rsvps.filter((r) => r.attendance === "no").length;
  return { rsvps, yes, no, total: rsvps.length };
}

function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: "sqlite", file: "data/party.db" });
});

app.get("/api/poll", (_req, res) => {
  res.json(readPoll());
});

app.post("/api/poll", (req, res) => {
  const voterId = String(req.body?.voterId || "").trim().slice(0, 80);
  const team = String(req.body?.team || "").trim();

  if (!voterId) return jsonError(res, 400, "voterId is required");
  if (team !== "boy" && team !== "girl") {
    return jsonError(res, 400, "team must be boy or girl");
  }

  const existing = db
    .prepare(`SELECT team FROM votes WHERE voter_id = ?`)
    .get(voterId);

  if (existing) {
    return res.status(200).json({
      ...readPoll(),
      alreadyVoted: true,
      myTeam: existing.team,
    });
  }

  db.prepare(
    `INSERT INTO votes (voter_id, team, created_at) VALUES (?, ?, ?)`
  ).run(voterId, team, Date.now());

  res.status(201).json({
    ...readPoll(),
    alreadyVoted: false,
    myTeam: team,
  });
});

app.get("/api/rsvps", (_req, res) => {
  res.json(readRsvps());
});

app.post("/api/rsvps", (req, res) => {
  const deviceId = String(req.body?.deviceId || "").trim().slice(0, 80);
  const name = String(req.body?.name || "").trim().slice(0, 40);
  const attendance = String(req.body?.attendance || "").trim();

  if (!deviceId) return jsonError(res, 400, "deviceId is required");
  if (!name) return jsonError(res, 400, "name is required");
  if (attendance !== "yes" && attendance !== "no") {
    return jsonError(res, 400, "attendance must be yes or no");
  }

  const existing = db
    .prepare(`SELECT name, attendance FROM rsvps WHERE device_id = ?`)
    .get(deviceId);

  if (existing) {
    return res.status(200).json({
      ...readRsvps(),
      alreadyRsvped: true,
      myName: existing.name,
      myAttendance: existing.attendance,
    });
  }

  db.prepare(
    `INSERT INTO rsvps (device_id, name, attendance, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(deviceId, name, attendance, Date.now());

  res.status(201).json({
    ...readRsvps(),
    alreadyRsvped: false,
    myName: name,
    myAttendance: attendance,
  });
});

app.use(express.static(ROOT, { extensions: ["html"] }));

app.listen(PORT, () => {
  console.log(`Gender reveal running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
