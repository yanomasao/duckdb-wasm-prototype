import { Table } from "apache-arrow";
import { useEffect, useState } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";
import { DuckDbQuery } from "./components/DuckDbQuery";
import { DuckDbResult } from "./components/DuckDbResult";
import Map from "./components/Map";
import { TableList } from "./components/TableList";
import { useDuckDB } from "./hooks/useDuckDB";
import viteLogo from "/vite.svg";

interface Point {
    geom: string;
    name: string;
    isQueryResult?: boolean;
    color?: string;
}

function App() {
    const { db, error: dbError } = useDuckDB();
    const [queryResult, setQueryResult] = useState<Table | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [columnAliases, setColumnAliases] = useState<{
        [key: string]: { [key: string]: string };
    }>({});

    // テーブルごとの色を管理するstate
    const [tableColors, setTableColors] = useState<{ [key: string]: string }>(
        {}
    );

    // ランダムな色を生成する関数
    const generateRandomColor = () => {
        // HSLカラーモデルを使用
        // H: 0-360 (色相)
        // S: 70% (彩度)
        // L: 50% (明度)
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 50%)`;
    };

    // Fetch tables
    const fetchTables = async () => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query("SHOW TABLES;");
            const tableNames: string[] = [];
            for (let i = 0; i < result.numRows; i++) {
                tableNames.push(result.getChildAt(0)?.get(i) as string);
            }
            setTables(tableNames);
            await conn.close();
        } catch (err) {
            console.error("Error fetching tables:", err);
        }
    };

    // Fetch data from selected tables
    useEffect(() => {
        async function fetchSelectedTablesData() {
            if (!db || selectedTables.length === 0) return;

            try {
                const conn = await db.connect();
                await conn.query("LOAD spatial;");

                const allPoints: Point[] = [];
                for (const tableName of selectedTables) {
                    const columns = columnAliases[tableName] || {};
                    const selectColumns = Object.entries(columns)
                        .map(([name, alias]) => `${name} as ${alias}`)
                        .join(", ");

                    const query = `
                        SELECT 
                            ST_AsGeoJSON(geom) as geom,
                            ${selectColumns || "name"}
                        FROM ${tableName}
                    `;

                    const result = await conn.query(query);

                    for (let i = 0; i < result.numRows; i++) {
                        allPoints.push({
                            geom: result.getChildAt(0)?.get(i) as string,
                            name: result.getChildAt(1)?.get(i) as string,
                            isQueryResult: true,
                            color:
                                tableColors[tableName] || generateRandomColor(),
                        });
                    }
                }
                setPoints(allPoints);
                await conn.close();
            } catch (err) {
                console.error("Error fetching table data:", err);
            }
        }

        fetchSelectedTablesData();
    }, [db, selectedTables, columnAliases, tableColors]);

    const handleTableSelect = (tableName: string) => {
        setSelectedTables((prev) => {
            if (prev.includes(tableName)) {
                return prev.filter((t) => t !== tableName);
            } else {
                // 新しいテーブルが選択されたときに色を生成
                setTableColors((prev) => ({
                    ...prev,
                    [tableName]: generateRandomColor(),
                }));
                return [...prev, tableName];
            }
        });
    };

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
            // テーブルリストを更新
            fetchTables();
        } catch (err) {
            console.error("Query error:", err);
            setQueryError(
                err instanceof Error ? err.message : "Unknown error occurred"
            );
        }
    };

    const showTables = async () => {
        await fetchTables();
    };

    const handleColumnAliasChange = (
        tableName: string,
        columnName: string,
        alias: string
    ) => {
        setColumnAliases((prev) => ({
            ...prev,
            [tableName]: {
                ...(prev[tableName] || {}),
                [columnName]: alias,
            },
        }));
    };

    const handleTableDelete = async (tableName: string) => {
        if (!db) return;

        // 確認ダイアログを表示
        if (
            !window.confirm(
                `テーブル "${tableName}" を削除してもよろしいですか？`
            )
        ) {
            return;
        }

        try {
            const conn = await db.connect();
            await conn.query(`DROP TABLE ${tableName};`);
            await conn.close();
            console.log("Table deleted:", tableName);

            // テーブルリストを更新
            fetchTables();

            // 選択中のテーブルから削除
            setSelectedTables((prev) => prev.filter((t) => t !== tableName));

            // テーブルの色情報を削除
            setTableColors((prev) => {
                const newColors = { ...prev };
                delete newColors[tableName];
                return newColors;
            });

            // カラムエイリアス情報を削除
            setColumnAliases((prev) => {
                const newAliases = { ...prev };
                delete newAliases[tableName];
                return newAliases;
            });
        } catch (err) {
            console.error("Error deleting table:", err);
            alert("テーブルの削除に失敗しました");
        }
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
                <TableList
                    tables={tables}
                    selectedTables={selectedTables}
                    onTableSelect={handleTableSelect}
                    db={db}
                    onColumnAliasChange={handleColumnAliasChange}
                    onTableDelete={handleTableDelete}
                />
            </div>
            <Map points={points} db={db} />
            <p className='read-the-docs'>
                Click on the Vite and React logos to learn more
            </p>
        </>
    );
}

export default App;
