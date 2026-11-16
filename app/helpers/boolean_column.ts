// SQLite and MySQL/MariaDB return 0/1 for boolean columns; PostgreSQL returns booleans.
export const booleanColumn = { consume: (value: unknown) => Boolean(value) }
