import { useEffect, useState } from 'react';

const RemoteResources = () => {
    const [files, setFiles] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('http://localhost:8081/api/files');
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

    if (isLoading) {
        return <div>Loading files...</div>;
    }

    if (error) {
        return <div className="error">Error: {error}</div>;
    }

    return (
        <div className="remote-resources">
            <h3>Remote Files</h3>
            <div className="file-list">
                {files.length === 0 ? (
                    <p>No files found</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>File Name</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(fileName => (
                                <tr key={fileName}>
                                    <td>{fileName}</td>
                                    <td>{getFileType(fileName)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// ファイルの拡張子を取得する関数
const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    return extension;
};

export default RemoteResources;
