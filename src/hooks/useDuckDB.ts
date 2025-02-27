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

                // const DUCKDB_CONFIG = new duckdb.DuckDBConfig();
                // DUCKDB_CONFIG.set_allow_unsigned_extensions(true);


                // DuckDBをインスタンス化
                const worker = new Worker(bundle.mainWorker!);
                const logger = new duckdb.ConsoleLogger();
                const db = new duckdb.AsyncDuckDB(logger, worker);
                // await db.open({
                //     path: 'opfs://duckdb2.db',
                //     accessMode: duckdb.DuckDBAccessMode.READ_WRITE
                // });
                // const opfs = await navigator.storage.getDirectory();
                // const fileHandle = await opfs.getFileHandle("duckdb.db", {
                //     create: true,
                // });
                // const dirHandle = await fileHandle.getFile('duckdb', { create: true });
                // await db.registerFileHandle('duckdb.db', fileHandle, duckdb.DuckDBDataProtocol.OPFS, true);
                await db.instantiate(bundle.mainModule);

                // Install and load the spatial extension
                const conn = await db.connect();
                await conn.query('INSTALL spatial;');
                await conn.query('LOAD spatial;');
                await conn.close();

                // OPFSにDuckDBを配置
                // const opfs = await navigator.storage.getDirectory();
                // const fileHandle = await opfs.getFileHandle("duckdb.db", {
                //     create: true,
                // });
                // const dirHandle = await fileHandle.getFile('duckdb', { create: true });
                // await db.registerFileHandle('duckdb.db', fileHandle, duckdb.DuckDBDataProtocol.HTTP, true);
                // await db.open({
                //     path: 'opfs://duckdb10.db',
                //     // path: ':memory:', // Use ':memory:' for in-memory
                //     accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
                // });
                // const conn = await db.connect();
                // const anotherFileHandle = await opfsRoot.getFileHandle("my first file", {
                // create: true,
                // });

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
