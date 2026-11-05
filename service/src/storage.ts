// Source archives are small and bounded. Database chunks avoid a separate billed object-storage subscription.
export class SqlObjectStore {
  constructor(
    private db: D1Database,
    private namespace: string,
  ) {}
  async put(key: string, input: Uint8Array | string) {
    const bytes =
      typeof input === "string" ? new TextEncoder().encode(input) : input;
    if (bytes.length > 4194304)
      throw new Error("Archive exceeds storage limit");
    const old = await this.db
      .prepare("SELECT generation FROM objects WHERE namespace=? AND key=?")
      .bind(this.namespace, key)
      .first<{ generation: string }>();
    const generation = crypto.randomUUID(),
      statements: D1PreparedStatement[] = [];
    for (let p = 0, part = 0; p < bytes.length; p += 262144, part++)
      statements.push(
        this.db
          .prepare("INSERT INTO object_chunks VALUES(?,?,?)")
          .bind(generation, part, bytes.slice(p, p + 262144).buffer),
      );
    statements.push(
      this.db
        .prepare(
          "INSERT INTO objects VALUES(?,?,?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET generation=excluded.generation,size=excluded.size,metadata=excluded.metadata",
        )
        .bind(this.namespace, key, generation, bytes.length, "{}"),
    );
    if (old)
      statements.push(
        this.db
          .prepare("DELETE FROM object_chunks WHERE generation=?")
          .bind(old.generation),
      );
    await this.db.batch(statements);
  }
  async get(key: string) {
    const meta = await this.db
      .prepare(
        "SELECT generation,size FROM objects WHERE namespace=? AND key=?",
      )
      .bind(this.namespace, key)
      .first<{ generation: string; size: number }>();
    if (!meta) return null;
    const rows = await this.db
      .prepare(
        "SELECT data FROM object_chunks WHERE generation=? ORDER BY part",
      )
      .bind(meta.generation)
      .all<{ data: number[] }>();
    const bytes = new Uint8Array(meta.size);
    let offset = 0;
    for (const row of rows.results) {
      const b = new Uint8Array(row.data);
      bytes.set(b, offset);
      offset += b.length;
    }
    if (offset !== meta.size)
      throw new Error("Archive storage integrity check failed");
    return {
      arrayBuffer: async () => bytes.buffer,
      json: async <T>() => JSON.parse(new TextDecoder().decode(bytes)) as T,
    };
  }
}
