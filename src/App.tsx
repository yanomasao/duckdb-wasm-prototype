import { AsyncDuckDBResult } from "@duckdb/duckdb-wasm";
import { useState } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";
import { DuckDbQuery } from "./components/DuckDbQuery";
import { DuckDbResult } from "./components/DuckDbResult";
import { useDuckDB } from "./hooks/useDuckDB";
import viteLogo from "/vite.svg";

function App() {
    const [count, setCount] = useState(0);
    const { db, error: dbError } = useDuckDB();
    const [queryResult, setQueryResult] = useState<AsyncDuckDBResult | null>(
        null
    );
    const [queryError, setQueryError] = useState<string | null>(null);

    const executeQuery = async (query: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query(query);
            setQueryResult(result);
            setQueryError(null);
            await conn.close();
        } catch (err) {
            console.error("Query error:", err);
            setQueryError(
                err instanceof Error ? err.message : "Unknown error occurred"
            );
            setQueryResult(null);
        }
    };

    const showTables = async () => {
        await executeQuery("SHOW TABLES;");
    };

    if (dbError) {
        return <div>Error initializing DuckDB: {dbError.message}</div>;
    }

    return (
        <>
            <div>
                <a href='https://vite.dev' target='_blank'>
                    <img src={viteLogo} className='logo' alt='Vite logo' />
                </a>
                <a href='https://react.dev' target='_blank'>
                    <img
                        src={reactLogo}
                        className='logo react'
                        alt='React logo'
                    />
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className='card'>
                <button onClick={() => setCount((count) => count + 1)}>
                    count is {count}
                </button>
                <DuckDbQuery
                    onExecute={executeQuery}
                    onShowTables={showTables}
                    disabled={!db}
                />
                <DuckDbResult result={queryResult} error={queryError} />
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className='read-the-docs'>
                Click on the Vite and React logos to learn more
            </p>
        </>
    );
}

export default App;
