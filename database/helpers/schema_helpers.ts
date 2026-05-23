import type { Knex } from 'knex'

/**
 * Creates a JSON column that uses JSONB on PostgreSQL (for indexing and performance)
 * and falls back to JSON on MySQL / TEXT on SQLite.
 */
export function jsonColumn(table: Knex.CreateTableBuilder, name: string) {
  const client = (table as any).client?.config?.client
  if (client === 'pg') {
    return table.jsonb(name)
  }
  return table.json(name)
}

/**
 * Returns the active database client identifier.
 */
export function getClient(
  schema: any
): 'pg' | 'mysql2' | 'better-sqlite3' | string {
  return schema.client?.config?.client ?? ''
}
