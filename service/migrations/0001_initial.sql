PRAGMA foreign_keys = ON;
CREATE TABLE admins(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions(hash TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admins(id), expires_at INTEGER NOT NULL);
CREATE TABLE throttle(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
CREATE TABLE deployments(id TEXT PRIMARY KEY, version TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('stable','beta')), status TEXT NOT NULL, digest TEXT NOT NULL, manifest TEXT NOT NULL, summary TEXT NOT NULL, source_sha TEXT, run_id TEXT, error TEXT, created_at TEXT NOT NULL, actor TEXT NOT NULL, UNIQUE(channel,version));
CREATE TABLE releases(id TEXT PRIMARY KEY, deployment_id TEXT NOT NULL UNIQUE REFERENCES deployments(id), version TEXT NOT NULL, channel TEXT NOT NULL, notes TEXT NOT NULL, url TEXT NOT NULL, signature TEXT NOT NULL, sha256 TEXT NOT NULL, urgent INTEGER NOT NULL DEFAULT 0, withdrawn INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, source_sha TEXT NOT NULL, UNIQUE(channel,version));
CREATE TABLE audit(id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE policy(id INTEGER PRIMARY KEY CHECK(id=1), auto_publish INTEGER NOT NULL DEFAULT 0);
INSERT INTO policy VALUES(1,0);
