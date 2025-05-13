import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { useState } from 'react';

interface RemoteFileProps {
    db: AsyncDuckDB;
    onTableCreated?: () => void;
}

const RemoteFile: React.FC<RemoteFileProps> = ({ db, onTableCreated }) => {
    const [url, setUrl] = useState<string>('');
    const [isCreatingTable, setIsCreatingTable] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [show, setShow] = useState(false);

    const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(event.target.value);
    };

    const createTableFromUrl = async () => {
        if (!db || !url.trim()) return;

        setIsCreatingTable(true);
        document.body.classList.add('creating-table');
        let conn = null;

        try {
            conn = await db.connect();
            await conn.query('LOAD spatial;');

            // URLからファイル名を抽出
            const fileName = url.split('/').pop() || 'remote_file';
            let tableName = fileName.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_');
            if (/^\d/.test(tableName)) {
                tableName = `t_${tableName}`;
            }

            const isParquet = url.toLowerCase().endsWith('.parquet');
            const query = isParquet ? `CREATE TABLE ${tableName} AS SELECT * FROM '${url}'` : `CREATE TABLE ${tableName} AS SELECT * FROM st_read('${url}')`;

            await conn.query(query);
            await conn.query(`CREATE INDEX ${tableName}_idx ON ${tableName} USING RTREE (geom);`);
            await conn.query('CHECKPOINT;');

            console.log('Table created and checkpoint executed:', tableName);
            setError(null);
            setUrl(''); // 入力をクリア
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
        <div className="remote-file">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Remote File</h3>
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
                        <input
                            type="url"
                            value={url}
                            onChange={handleUrlChange}
                            placeholder="Enter file URL (.parquet, .geojson, .shp)"
                            style={{ flex: 1, padding: '0.5em' }}
                        />
                        <button onClick={createTableFromUrl} disabled={!db || !url.trim() || isCreatingTable}>
                            {isCreatingTable ? 'テーブル作成中...' : 'Create Table from URL'}
                        </button>
                    </div>
                    {isCreatingTable && <div style={{ color: '#0066cc', marginLeft: '2px' }}>処理中...</div>}
                    {error && <div style={{ color: 'red' }}>Error: {error}</div>}
                </div>
            )}
        </div>
    );
};

export default RemoteFile;
