// import { AsyncDuckDBResult } from "@duckdb/duckdb-wasm";
import { useState } from 'react';
import './App.css';
import reactLogo from './assets/react.svg';
import { DuckDbQuery } from './components/DuckDbQuery';
import { DuckDbResult } from './components/DuckDbResult';
import { useDuckDB } from './hooks/useDuckDB';
import viteLogo from '/vite.svg';

function App() {
    const { db, error: dbError } = useDuckDB();
    const [queryResult, setQueryResult] = useState<any | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const executeQuery = async (query: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            await conn.query('LOAD spatial;');
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

    const createTableFromFileNEW = async () => {
        if (!db || !file) return;
        const conn = await db.connect();
        const fileContent = await file.text();
        console.log('fileContent:', fileContent);
        // await conn.query('LOAD spatial;');
        // ..., from JSON documents in row-major format
        // const jsonRowContent = [
        //     { col1: 1, col2: 'foo' },
        //     { col1: 2, col2: 'bar' },
        // ];
        // await db.registerFileText('rows.json', JSON.stringify(jsonRowContent));
        await db.registerFileText('rows.json', fileContent);
        await conn.insertJSONFromPath('rows.json', { name: 'rows' });
    };

    const createTableFromFile = async () => {
        if (!db || !file) return;

        try {
            const filePath = `/tmp/${file.name}`;
            const fileContent = await file.text();
            const conn = await db.connect();
            // await conn.query('INSTALL spatial;');
            // await conn.query('INSTALL json;');
            await conn.query('LOAD spatial;');
            // await conn.query('LOAD json;');
            console.log('fileContent:', fileContent);
            const tableName = file.name.split('.')[0];
            if (file.name.endsWith('.csv')) {
                await conn.query(
                    `COPY (SELECT '${fileContent}') TO '${filePath}' (FORMAT 'csv');`
                );
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${filePath}', HEADER=TRUE, strict_mode=false, max_line_size=10000000, ignore_errors=true);`;
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${filePath}', HEADER=TRUE, strict_mode=false, max_line_size=10000000);`;
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('${filePath}');`;
                const query = `CREATE TABLE ${tableName} AS SELECT '${fileContent}';`;
                await conn.query(query);
            } else if (
                file.name.endsWith('.geojson') ||
                file.name.endsWith('.json')
            ) {
                // const origin = window.location.origin;
                // const path = window.location.pathname;
                // let basename = origin;
                // if (path !== '/') {
                //     basename = origin + path;
                // }
                // console.log('basename:', basename);

                // await conn.query(
                //     `COPY (SELECT '${fileContent}') TO '${filePath}' (FORMAT 'json');`
                //     // `COPY (SELECT '${fileContent}') TO '${filePath}';`
                // );
                // await conn.send('CHECKPOINT;');
                // await conn.close();

                // OPFS にファイルを書き込む
                // const opfs = await navigator.storage.getDirectory();
                // const dirHandle = await opfs.getDirectoryHandle('tmp', {
                //     create: true,
                // });
                // const fileHandle = await dirHandle.getFileHandle(file.name, {
                //     create: true,
                // });
                // // 書き込み用のストリームを取得する
                // const writable = await fileHandle.createWritable();
                // await writable.write(fileContent);
                // await writable.close();

                // // DuckDB にファイルハンドルを登録
                // await db.registerFileHandle(
                //     file.name,
                //     // 'foo',
                //     fileHandle,
                //     duckdb.DuckDBDataProtocol.OPFS,
                //     // duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
                //     // duckdb.DuckDBDataProtocol.BROWSER_FSACCESS,
                //     true
                // );
                // // await db.registerFileHandle('local.minato_wk.geojson', file);

                // conn = await db.connect();
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${filePath}');`;
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('${filePath}');`;
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('${fileContent}', 'GeoJSON');`;
                const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('http://localhost:5173/tmp/${file.name}');`;
                // const escapedGeoJSON = fileContent.replace(/'/g, "''");
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${escapedGeoJSON}');`;
                // const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('opfs://tmp/${file.name}', allowed_drivers := ARRAY['GeoJSON']);`;
                await conn.query(query);
                console.log('Table created:', tableName);
                // if (writable) {
                //     await writable.close().catch((e) => {
                //         console.error('Error closing writable:', e);
                //     });
                // }
            }
            await conn.close();
            setQueryError(null);
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
            <div className='card'>
                <input type='file' onChange={handleFileChange} />
                <button onClick={createTableFromFile} disabled={!db || !file}>
                    Create Table from File
                </button>
                <DuckDbQuery
                    onExecute={executeQuery}
                    onShowTables={showTables}
                    disabled={!db}
                />
                <DuckDbResult result={queryResult} error={queryError} />
            </div>
            <p className='read-the-docs'>
                Click on the Vite and React logos to learn more
            </p>
        </>
    );
}

export default App;
