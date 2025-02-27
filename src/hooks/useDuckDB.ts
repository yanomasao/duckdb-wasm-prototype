import * as duckdb from "@duckdb/duckdb-wasm";
import { useEffect, useState } from "react";

export function useDuckDB() {
    const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function initDB() {
            try {
                // DuckDBのWASMバンドルをロード
                const bundle = await duckdb.selectBundle({
                    mvp: {
                        mainModule: new URL(
                            "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm",
                            import.meta.url
                        ).toString(),
                        mainWorker: new URL(
                            "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js",
                            import.meta.url
                        ).toString(),
                    },
                    eh: {
                        mainModule: new URL(
                            "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
                            import.meta.url
                        ).toString(),
                        mainWorker: new URL(
                            "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js",
                            import.meta.url
                        ).toString(),
                    },
                });

                // DuckDBをインスタンス化
                const worker = new Worker(bundle.mainWorker!);
                const logger = new duckdb.ConsoleLogger();
                const db = new duckdb.AsyncDuckDB(logger, worker);
                await db.instantiate(bundle.mainModule);

                setDb(db);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to initialize DuckDB")
                );
            }
        }

        initDB();

        return () => {
            // クリーンアップ
            if (db) {
                db.terminate();
            }
        };
    }, []);

    return { db, error };
}
