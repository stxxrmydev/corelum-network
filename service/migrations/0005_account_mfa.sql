CREATE TABLE IF NOT EXISTS account_mfa (
  account_id TEXT PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL,
  enabled_at INTEGER
);
