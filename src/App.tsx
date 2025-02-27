// import { AsyncDuckDBResult } from "@duckdb/duckdb-wasm";
import { useState } from 'react';
import './App.css';
import reactLogo from './assets/react.svg';
import { DuckDbQuery } from './components/DuckDbQuery';
import { DuckDbResult } from './components/DuckDbResult';
import { useDuckDB } from './hooks/useDuckDB';
import viteLogo from '/vite.svg';

function App() {
    const [count, setCount] = useState(0);
    const { db, error: dbError } = useDuckDB();
    const [queryResult, setQueryResult] = useState<any | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const executeQuery = async (query: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query(query);
            setQueryResult(result);
            setQueryError(null);
            await conn.close();
        } catch (err) {
            console.error('Query error:', err);
            setQueryError(
                err instanceof Error ? err.message : 'Unknown error occurred'
            );
            setQueryResult(null);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
    };

    const createTableFromFile = async () => {
        if (!db || !file) return;

        try {
            const filePath = `/tmp/${file.name}`;
            const fileContent = await file.text();
            const conn = await db.connect();
            await conn.query('INSTALL spatial;');
            await conn.query('INSTALL json;');
            await conn.query('LOAD spatial;');
            await conn.query('LOAD json;');
            console.log('fileContent:', fileContent);
            const tableName = file.name.split('.')[0];
            if (file.name.endsWith('.csv')) {
                await conn.query(
                    `COPY (SELECT '${fileContent}') TO '${filePath}' (FORMAT 'csv');`
                );
                const query = `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${filePath}', HEADER=TRUE);`;
                await conn.query(query);
            } else if (file.name.endsWith('.geojson')) {
                // const origin = window.location.origin;
                // const path = window.location.pathname;
                // let basename = origin;
                // if (path !== '/') {
                //     basename = origin + path;
                // }
                // console.log('basename:', basename);
                await conn.query(
                    `COPY (SELECT '${fileContent}') TO '${filePath}' (FORMAT 'json');`
                    // `COPY (SELECT '${fileContent}') TO '${filePath}';`
                );
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${filePath}');`;
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('${filePath}');`;
                const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('http://localhost:5173/minato_wk.geojson');`;
                await conn.query(query);
            }
            setQueryError(null);
            await conn.close();
        } catch (err) {
            console.error('Query error:', err);
            setQueryError(
                err instanceof Error ? err.message : 'Unknown error occurred'
            );
        }
    };

    const showTables = async () => {
        await executeQuery('SHOW TABLES;');
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
                <input type='file' onChange={handleFileChange} />
                <button onClick={createTableFromFile} disabled={!db || !file}>
                    Create Table from File
                </button>
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
