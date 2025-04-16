import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { useState } from 'react';

interface LocalFilesProps {
    db: AsyncDuckDB;
    onTableCreated?: () => void;
}

const LocalFiles: React.FC<LocalFilesProps> = ({ db, onTableCreated }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isCreatingTable, setIsCreatingTable] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [show, setShow] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
    };

    const createTableFromFile = async () => {
        if (!db || !file) return;

        setIsCreatingTable(true);
        document.body.classList.add('creating-table');
        let conn = null;

        try {
            conn = await db.connect();
            await conn.query('LOAD spatial;');

            let tableName = file.name.split('.')[0].replace(/-/g, '_');
            if (/^\d/.test(tableName)) {
                tableName = `t_${tableName}`;
            }

            const isParquet = file.name.toLowerCase().endsWith('.parquet');
            const query = isParquet
                ? `CREATE TABLE ${tableName} AS SELECT * FROM 'http://localhost:5173/tmp/${file.name}'`
                : `CREATE TABLE ${tableName} AS SELECT * FROM st_read('http://localhost:5173/tmp/${file.name}')`;

            await conn.query(query);
            await conn.query(`CREATE INDEX ${tableName}_idx ON ${tableName} USING RTREE (geom);`);
            await conn.query('CHECKPOINT;');

            console.log('Table created and checkpoint executed:', tableName);
            setError(null);
            onTableCreated?.();
        } catch (err) {
            console.error('Query error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            if (conn) {
                await conn.close();
            }
            setIsCreatingTable(false);
            document.body.classList.remove('creating-table');
        }
    };

    return (
        <div className="local-files">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Local Files</h3>
                <button onClick={() => setShow(!show)} disabled={!db}>
                    {show ? '隠す' : '表示'}
                </button>
            </div>

            {show && (
                <div
                    style={{
                        backgroundColor: '#f5f5f5',
                        padding: '10px',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                    }}
                >
                    <div className="file-upload">
                        <input type="file" onChange={handleFileChange} accept=".parquet,.geojson,.shp" />
                        <button onClick={createTableFromFile} disabled={!db || !file || isCreatingTable}>
                            {isCreatingTable ? 'テーブル作成中...' : 'Create Table from File'}
                        </button>
                    </div>
                    {isCreatingTable && <div style={{ color: '#0066cc', marginLeft: '2px' }}>処理中...</div>}
                    {error && <div style={{ color: 'red' }}>Error: {error}</div>}
                </div>
            )}
        </div>
    );
};

export default LocalFiles;
