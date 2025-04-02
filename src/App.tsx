import { Table } from "apache-arrow";
import { useEffect, useState } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";
import { DuckDbQuery } from "./components/DuckDbQuery";
import { DuckDbResult } from "./components/DuckDbResult";
import Map from "./components/Map";
import MapSetting from './components/MapSetting';
import { TableList } from "./components/TableList";
import { useDuckDB } from "./hooks/useDuckDB";
import { createTileGeoJSON } from "./utils/tileUtils";
import viteLogo from "/vite.svg";

interface Point {
    geom: string;
    name: string;
    isQueryResult?: boolean;
    color?: string;
    tableName: string;
    columnValues?: Record<string, string | number>;
}

interface ColumnInfo {
    name: string;
    selected: boolean;
    alias: string;
}

function App() {
    const { db, error: dbError } = useDuckDB();
    const [file, setFile] = useState<File | null>(null);
    const [queryResult, setQueryResult] = useState<Table | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [points, setPoints] = useState<Point[]>([]);
    const [tableColors, setTableColors] = useState<{ [key: string]: string }>(
        {}
    );
    const [columnAliases, setColumnAliases] = useState<{
        [key: string]: { [key: string]: string };
    }>({});
    const [tableConditions, setTableConditions] = useState<{
        [key: string]: string;
    }>({});
    const [limitToTileStates, setLimitToTileStates] = useState<{
        [key: string]: boolean;
    }>({});
    const [columnStates, setColumnStates] = useState<{
        [key: string]: ColumnInfo[];
    }>({});
    const [isCreatingTable, setIsCreatingTable] = useState(false);
    const [mapParams, setMapParams] = useState({ zoom: 10, lat: 35.7, lng: 139.7 });
    const [showTile, setShowTile] = useState(true);

    // ランダムな色を生成する関数
    const generateRandomColor = () => {
        const letters = "0123456789ABCDEF";
        let color = "#";
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
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
                    const tableColumns = columnStates[tableName] || [];
                    const selectedColumnNames = tableColumns
                        .filter((col) => col.selected)
                        .map((col) => col.name);

                    // Build SELECT clause with proper quoting for special characters
                    const selectClause = [
                        "ST_AsGeoJSON(geom) as geom",
                        ...selectedColumnNames.map((col) => {
                            const needsQuotes =
                                /[^a-zA-Z0-9_]/.test(col) ||
                                /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
                                    col
                                );
                            return needsQuotes ? `"${col}"` : col;
                        }),
                    ].join(", ");

                    const condition = tableConditions[tableName] || "";
                    const limitToTile = limitToTileStates[tableName] || false;

                    // タイル内限定が有効な場合、タイルのGeoJSONを作成してST_Intersectsで絞り込む
                    let whereClause = "";
                    if (limitToTile) {
                        const tileGeoJSON = createTileGeoJSON(mapParams.zoom, mapParams.lat, mapParams.lng);
                        const tileGeom = `ST_GeomFromGeoJSON('${JSON.stringify(tileGeoJSON.geometry)}')`;
                        whereClause = `WHERE ST_Intersects(geom, ${tileGeom})`;
                        if (condition) {
                            whereClause += ` AND ${condition}`;
                        }
                    } else if (condition) {
                        whereClause = `WHERE ${condition}`;
                    }

                    const query = `
                        SELECT ${selectClause}
                        FROM ${tableName}
                        ${whereClause}
                    `;

                    console.log("Executing query:", query); // デバッグ用

                    const result = await conn.query(query);
                    const schema = result.schema;

                    for (let i = 0; i < result.numRows; i++) {
                        const columnValues: Record<string, string | number> = {};
                        // Start from index 1 because 0 is geom
                        for (let j = 1; j < schema.fields.length; j++) {
                            const columnName = schema.fields[j].name;
                            const value = result.getChildAt(j)?.get(i);
                            if (value !== null && value !== undefined) {
                                if (typeof value === "number") {
                                    columnValues[columnName] = value;
                                } else if (
                                    typeof value === "object" &&
                                    value.toString
                                ) {
                                    columnValues[columnName] = value.toString();
                                } else {
                                    columnValues[columnName] = String(value);
                                }
                            }
                        }

                        allPoints.push({
                            geom: result.getChildAt(0)?.get(i) as string,
                            name: tableName,
                            isQueryResult: true,
                            color: tableColors[tableName] || generateRandomColor(),
                            tableName: tableName,
                            columnValues: columnValues,
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
    }, [db, selectedTables, columnStates, tableColors, tableConditions, limitToTileStates, mapParams]);

    const handleTableSelect = (tableName: string) => {
        setSelectedTables((prev) => {
            if (prev.includes(tableName)) {
                return prev.filter((t) => t !== tableName);
            } else {
                // Initialize columnStates for the new table
                if (!columnStates[tableName]) {
                    initializeTableColumns(tableName);
                }
                // 新しいテーブルが選択されたときに色を生成
                setTableColors((prev) => ({
                    ...prev,
                    [tableName]: generateRandomColor(),
                }));
                return [...prev, tableName];
            }
        });
    };

    // Add this new function to initialize table columns
    const initializeTableColumns = async (tableName: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query(`DESCRIBE ${tableName};`);
            const columnNames: ColumnInfo[] = [];

            for (let i = 0; i < result.numRows; i++) {
                const name = result.getChildAt(0)?.get(i) as string;
                columnNames.push({
                    name,
                    selected: false,
                    alias: "",
                });
            }

            setColumnStates((prev) => ({
                ...prev,
                [tableName]: columnNames,
            }));

            await conn.close();
        } catch (err) {
            console.error("Error fetching columns:", err);
        }
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

        setIsCreatingTable(true);
        // テーブル作成中のクラスを追加
        document.body.classList.add("creating-table");
        try {
            const conn = await db.connect();
            await conn.query("LOAD spatial;");

            let tableName = file.name.split(".")[0].replace(/-/g, "_");
            // 最初の文字が数字の場合、t_をプレフィックスとして追加
            if (/^\d/.test(tableName)) {
                tableName = `t_${tableName}`;
            }

            const isParquet = file.name.toLowerCase().endsWith(".parquet");

            const query = isParquet
                ? `CREATE TABLE ${tableName} AS SELECT * FROM 'http://localhost:5173/tmp/${file.name}'`
                : `CREATE TABLE ${tableName} AS SELECT * FROM st_read('http://localhost:5173/tmp/${file.name}')`;

            await conn.query(query);
            // テーブルの作成後にcheckpointを実行
            await conn.query("CHECKPOINT;");
            console.log("Table created and checkpoint executed:", tableName);
            await conn.close();
            setQueryError(null);
            // テーブルリストを更新
            fetchTables();
        } catch (err) {
            console.error("Query error:", err);
            setQueryError(
                err instanceof Error ? err.message : "Unknown error occurred"
            );
        } finally {
            setIsCreatingTable(false);
            // テーブル作成中のクラスを削除
            document.body.classList.remove("creating-table");
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

    const handleTableConditionChange = (
        tableName: string,
        condition: string
    ) => {
        setTableConditions((prev) => ({
            ...prev,
            [tableName]: condition,
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
            // テーブルの削除後にcheckpointを実行
            await conn.query("CHECKPOINT;");
            await conn.close();
            console.log("Table deleted and checkpoint executed:", tableName);

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

            // テーブルの条件情報を削除
            setTableConditions((prev) => {
                const newConditions = { ...prev };
                delete newConditions[tableName];
                return newConditions;
            });
        } catch (err) {
            console.error("Error deleting table:", err);
            alert("テーブルの削除に失敗しました");
        }
    };

    const handleShowTableData = async (tableName: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query(`SELECT * FROM ${tableName};`);
            setQueryResult(result);
            setQueryError(null);
            await conn.close();
        } catch (err) {
            console.error("Error fetching table data:", err);
            setQueryError(
                err instanceof Error ? err.message : "Unknown error occurred"
            );
            setQueryResult(null);
        }
    };

    const handleLimitToTileChange = (tableName: string, limitToTile: boolean) => {
        setLimitToTileStates(prev => ({
            ...prev,
            [tableName]: limitToTile
        }));
    };

    const handleTileUpdate = (zoom: number, lat: number, lng: number) => {
        setMapParams({ zoom, lat, lng });
    };

    const handleShowTileChange = (show: boolean) => {
        setShowTile(show);
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
                <button
                    onClick={createTableFromFile}
                    disabled={!db || !file || isCreatingTable}
                >
                    {isCreatingTable
                        ? "テーブル作成中..."
                        : "Create Table from File"}
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
                    onTableConditionChange={handleTableConditionChange}
                    onShowTableData={handleShowTableData}
                    columnStates={columnStates}
                    setColumnStates={setColumnStates}
                    onColumnSelect={(
                        tableName: string,
                        columnName: string,
                        selected: boolean
                    ) => {
                        setColumnStates((prev) => ({
                            ...prev,
                            [tableName]: prev[tableName].map((col) =>
                                col.name === columnName
                                    ? { ...col, selected }
                                    : col
                            ),
                        }));
                    }}
                    onLimitToTileChange={handleLimitToTileChange}
                    limitToTileStates={limitToTileStates}
                />
            </div>
            <div className="card">
                <MapSetting 
                    onUpdate={handleTileUpdate} 
                    showTile={showTile}
                    onShowTileChange={handleShowTileChange}
                    lat={mapParams.lat}
                    lng={mapParams.lng}
                />
            </div>
            <Map 
                points={points} 
                db={db} 
                zoom={mapParams.zoom} 
                lat={mapParams.lat} 
                lng={mapParams.lng} 
                showTile={showTile}
                onMapClick={(lat, lng) => setMapParams(prev => ({ ...prev, lat, lng }))}
            />
        </>
    );
}

export default App;
