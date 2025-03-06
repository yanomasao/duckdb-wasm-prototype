import { Table } from "apache-arrow";
import { useEffect, useState } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";
import { DuckDbQuery } from "./components/DuckDbQuery";
import { DuckDbResult } from "./components/DuckDbResult";
import Map from "./components/Map";
import { useDuckDB } from "./hooks/useDuckDB";
import viteLogo from "/vite.svg";

interface Point {
    geom: string;
    name: string;
}

function App() {
    const { db, error: dbError } = useDuckDB();
    const [queryResult, setQueryResult] = useState<Table | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [points, setPoints] = useState<Point[]>([]);

    // Fetch points from minato_wk table
    useEffect(() => {
        async function fetchPoints() {
            if (!db) return;

            try {
                const conn = await db.connect();
                await conn.query("LOAD spatial;");
                const result = await conn.query(`
                    SELECT 
                        ST_AsGeoJSON(geom) as geom,
                        name
                    FROM tokyo
                `);

                // Convert the result to our Point interface
                const pointsData: Point[] = [];
                for (let i = 0; i < result.numRows; i++) {
                    pointsData.push({
                        geom: result.getChildAt(0)?.get(i) as string,
                        name: result.getChildAt(1)?.get(i) as string,
                    });
                }
                setPoints(pointsData);
                await conn.close();
            } catch (err) {
                console.error("Error fetching points:", err);
            }
        }

        fetchPoints();
    }, [db]);

    const executeQuery = async (query: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            await conn.query("LOAD spatial;");
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
    };

    const createTableFromFile = async () => {
        if (!db || !file) return;

        try {
            const conn = await db.connect();
            await conn.query("LOAD spatial;");

            const tableName = file.name.split(".")[0];
            const query = `CREATE TABLE ${tableName} AS SELECT * FROM st_read('http://localhost:5173/tmp/${file.name}');`;
            await conn.query(query);
            console.log("Table created:", tableName);
            await conn.close();
            setQueryError(null);
        } catch (err) {
            console.error("Query error:", err);
            setQueryError(
                err instanceof Error ? err.message : "Unknown error occurred"
            );
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
            <Map points={points} db={db} />
            <p className='read-the-docs'>
                Click on the Vite and React logos to learn more
            </p>
        </>
    );
}

export default App;
