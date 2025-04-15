import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { useEffect, useState } from 'react';

interface RemoteResourcesProps {
    db: AsyncDuckDB;
    onTableCreated?: () => void;
}

const remoteUrl = 'http://localhost:9191';

const RemoteResources: React.FC<RemoteResourcesProps> = ({ db, onTableCreated }) => {
    const [files, setFiles] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [show, setShow] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(remoteUrl + '/api/files');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setFiles(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch files');
                console.error('Error fetching files:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFiles();
    }, []);

    const handleFileClick = async (fileName: string) => {
        if (isProcessing || !db) return;
        setIsProcessing(true);
        setError(null);

        try {
            const conn = await db.connect();

            // テーブル名を生成（日本語を含むファイル名を適切に処理）
            let tableName = fileName
                .split('.')[0] // 拡張子を除去
                .replace(/[^a-zA-Z0-9_\u3000-\u9FFF]/g, '_') // 日本語とアルファベット、数字、アンダースコア以外を'_'に変換
                .replace(/^(\d)/, 't_$1'); // 数字で始まる場合、't_'をプレフィックスとして追加

            try {
                // 既存のテーブルを削除（存在する場合）
                await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);

                // URLから直接テーブルを作成
                const startTime = new Date();
                console.log(`計測 ${startTime.toISOString()} start create table`);
                await conn.query(`
                    CREATE TABLE "${tableName}" AS 
                    SELECT * FROM read_parquet('${remoteUrl}/api/parquet_stream?file=${encodeURIComponent(fileName)}')
                `);
                const endTime = new Date();
                const elapsedMs = endTime.getTime() - startTime.getTime();
                console.log(`計測 ${endTime.toISOString()} end create table, elapsed: ${elapsedMs}ms`);

                // 空間インデックスを作成（geomカラムが存在する場合）
                const columns = await conn.query(`DESCRIBE "${tableName}"`);
                const hasGeom = columns.toArray().some(row => row.column_name === 'geom');
                if (hasGeom) {
                    await conn.query(`CREATE INDEX "${tableName}_idx" ON "${tableName}" USING RTREE (geom)`);
                }

                console.log(`Table "${tableName}" created successfully`);
                onTableCreated?.(); // 親コンポーネントに通知
            } finally {
                await conn.close();
            }
        } catch (err) {
            console.error('Error processing file:', err);
            setError(err instanceof Error ? err.message : 'Failed to process file');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="remote-resources">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Remote Files</h3>
                <button onClick={() => setShow(!show)} disabled={!db}>
                    {show ? '隠す' : '表示'}
                </button>
                {isProcessing && <div style={{ color: '#0066cc' }}>処理中...</div>}
            </div>

            {show && (
                <div
                    style={{
                        backgroundColor: '#f5f5f5', // 薄いグレー
                        padding: '10px', // 内側の余白
                        borderRadius: '4px', // 角を丸く
                    }}
                >
                    {error && <div className="error">Error: {error}</div>}
                    <div className="file-list">
                        {files.length === 0 ? (
                            <p>No files found</p>
                        ) : (
                            <table style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>File Name</th>
                                        <th>Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {files.map(fileName => (
                                        <tr
                                            key={fileName}
                                            onClick={() => handleFileClick(fileName)}
                                            style={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    backgroundColor: '#e8e8e8', // ホバー時の背景色
                                                },
                                            }}
                                        >
                                            <td style={{ textAlign: 'left', padding: '4px 8px' }}>{fileName}</td>
                                            <td style={{ padding: '4px 8px' }}>{getFileType(fileName)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    return extension;
};

export default RemoteResources;
