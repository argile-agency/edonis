import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
// @ts-expect-error pg ships no type declarations and @types/pg is not installed
import pg from 'pg'

// pg returns NUMERIC/DECIMAL as strings (SQLite returns numbers); columns are at most decimal(10,2).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number)

const dbConfig = defineConfig({
  connection: env.get('DB_CONNECTION', 'postgres'),
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST', '127.0.0.1'),
        port: env.get('DB_PORT', 5432),
        user: env.get('DB_USER', 'postgres'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE', 'edonis_lms'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      seeders: {
        paths: ['database/seeders/main'],
      },
    },
    mysql: {
      client: 'mysql2',
      connection: {
        host: env.get('DB_HOST', '127.0.0.1'),
        port: env.get('DB_PORT', 3306),
        user: env.get('DB_USER', 'edonis'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE', 'edonis_lms'),
        // Same as the pg NUMERIC parser above: mysql2 returns DECIMAL as strings by default.
        decimalNumbers: true,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      seeders: {
        paths: ['database/seeders/main'],
      },
    },
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: env.get('DB_FILENAME', './tmp/db.sqlite3'),
      },
      useNullAsDefault: true,
      pool: {
        afterCreate: (conn: any, done: Function) => {
          conn.pragma('journal_mode = WAL')
          conn.pragma('foreign_keys = ON')
          done()
        },
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      seeders: {
        paths: ['database/seeders/main'],
      },
    },
  },
})

export default dbConfig
