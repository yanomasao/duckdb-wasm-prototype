import { Table } from 'apache-arrow';
import { useState } from 'react';
import './App.css';
import MapComponent from './components/Map';
import { useDuckDB } from './hooks/useDuckDB';

function App() {
    const { db, error: dbError } = useDuckDB();
    const [tables, setTables] = useState<{ name: string; count: number }[]>([]);
    const [showTableList, setShowTableList] = useState(false);
    const [queryResult, setQueryResult] = useState<Table | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isCreatingTable, setIsCreatingTable] = useState(false);

    // テーブル一覧を取得する関数
    const fetchTables = async () => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query('SHOW TABLES;');
            const tableNames: string[] = [];
            for (let i = 0; i < result.numRows; i++) {
                tableNames.push(result.getChildAt(0)?.get(i) as string);
            }

            // 各テーブルの行数を取得
            const tablesWithCount = await Promise.all(
                tableNames.map(async tableName => {
                    const countResult = await conn.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                    return {
                        name: tableName,
                        count: countResult.getChildAt(0)?.get(0) as number,
                    };
                })
            );

            setTables(tablesWithCount);
            await conn.close();
        } catch (err) {
            console.error('Error fetching tables:', err);
        }
    };

    // テーブル一覧の表示/非表示を切り替える関数
    const toggleTableList = async () => {
        if (!showTableList) {
            await fetchTables();
        }
        setShowTableList(prev => !prev);
    };

    // テーブルのデータを表示する関数
    const handleShowTableData = async (tableName: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            // geomカラムをGeoJSONとして取得
            const result = await conn.query(`
                SELECT 
                    ST_AsGeoJSON(geom) as geom_json,
                    * EXCLUDE (geom)
                FROM ${tableName};
            `);

            // 結果を整形
            const rows = result.toArray().map(row => {
                const newRow = { ...row };
                // geom_jsonをgeomとして設定
                if (newRow.geom_json) {
                    newRow.geom = JSON.parse(newRow.geom_json);
                    delete newRow.geom_json;
                }
                return newRow;
            });

            setQueryResult(rows);
            setQueryError(null);
            await conn.close();
        } catch (err) {
            console.error('Error fetching table data:', err);
            setQueryError(err instanceof Error ? err.message : 'Unknown error occurred');
            setQueryResult(null);
        }
    };

    // テーブルを削除する関数
    const handleTableDelete = async (tableName: string) => {
        if (!db) return;

        // 確認ダイアログを表示
        if (!window.confirm(`テーブル "${tableName}" を削除してもよろしいですか？`)) {
            return;
        }

        try {
            const conn = await db.connect();
            await conn.query(`DROP TABLE ${tableName};`);
            await conn.close();
            console.log('Table deleted:', tableName);

            // テーブルリストを更新
            fetchTables();
        } catch (err) {
            console.error('Error deleting table:', err);
            alert('テーブルの削除に失敗しました');
        }
    };

    // ファイル選択ハンドラー
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
    };

    // テーブル作成関数
    const createTableFromFile = async () => {
        if (!db || !file) return;

        setIsCreatingTable(true);
        // テーブル作成中のクラスを追加
        document.body.classList.add('creating-table');
        try {
            const conn = await db.connect();
            await conn.query('LOAD spatial;');

            let tableName = file.name.split('.')[0].replace(/-/g, '_');
            // 最初の文字が数字の場合、t_をプレフィックスとして追加
            if (/^\d/.test(tableName)) {
                tableName = `t_${tableName}`;
            }

            const isParquet = file.name.toLowerCase().endsWith('.parquet');

            const query = isParquet
                ? `CREATE TABLE ${tableName} AS SELECT * FROM 'http://localhost:5173/tmp/${file.name}'`
                : `CREATE TABLE ${tableName} AS SELECT * FROM st_read('http://localhost:5173/tmp/${file.name}')`;

            await conn.query(query);
            // テーブルの作成後にcheckpointを実行
            await conn.query('CHECKPOINT;');
            console.log('Table created and checkpoint executed:', tableName);
            await conn.close();
            setQueryError(null);
            // テーブルリストを更新
            fetchTables();
        } catch (err) {
            console.error('Query error:', err);
            setQueryError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setIsCreatingTable(false);
            // テーブル作成中のクラスを削除
            document.body.classList.remove('creating-table');
        }
    };

    return (
        <>
            <div className="card">
                <div className="file-upload">
                    <input type="file" onChange={handleFileChange} accept=".parquet,.geojson,.shp" />
                    <button onClick={createTableFromFile} disabled={!db || !file || isCreatingTable}>
                        {isCreatingTable ? 'テーブル作成中...' : 'Create Table from File'}
                    </button>
                </div>
                <button onClick={toggleTableList} disabled={!db}>
                    {showTableList ? 'テーブル一覧を隠す' : 'テーブル一覧を表示'}
                </button>
                {showTableList && (
                    <div className="table-list">
                        <h3>テーブル一覧</h3>
                        <ul>
                            {tables.map(table => (
                                <li key={table.name} className="table-item">
                                    <div className="table-name-container">
                                        <span className="table-name">{table.name}</span>
                                        <span className="table-count">({table.count.toLocaleString()}行)</span>
                                    </div>
                                    <div className="table-buttons">
                                        <button onClick={() => handleShowTableData(table.name)}>一覧</button>
                                        <button onClick={() => handleTableDelete(table.name)}>削除</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {queryError && <div className="query-error">{queryError}</div>}
                {queryResult && (
                    <div className="query-result">
                        <table>
                            <thead>
                                <tr>
                                    {Object.keys(queryResult[0]).map(key => (
                                        <th key={key}>{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {queryResult.map((row, index) => (
                                    <tr key={index}>
                                        {Object.entries(row).map(([key, value]) => (
                                            <td key={key}>{key === 'geom' ? <pre>{JSON.stringify(value, null, 2)}</pre> : String(value)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {db && <MapComponent db={db} />}
        </>
    );
}

export default App;
