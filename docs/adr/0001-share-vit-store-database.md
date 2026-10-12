# v2 shares vit-store's database, in its own schema

v2 lives in the same PlanetScale Postgres as vit-store, in a separate `shop` schema, with no PlanetScale branches. A second database or branch costs money every month, and the legacy migration becomes SQL inside one database. drizzle-kit only sees `shop` (`schemaFilter`), so it can never alter or drop the `ecom_vit_*` tables. Dev and tests run on local Docker Postgres, and only `main` migrates production. The old tables get dropped after cutover.
