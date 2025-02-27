import { Table } from 'apache-arrow';

interface DuckDbResultProps {
    result: Table | null;
    error: string | null;
}

export function DuckDbResult({ result, error }: DuckDbResultProps) {
    console.log('DuckDbResult', result, error);
    if (error) {
        return <div className='query-error'>Error: {error}</div>;
    }

    if (!result) {
        return null;
    }

    const headers = result.schema.fields.map((field) => field.name);
    console.log('headers', headers);
    // テーブルのデータを作成
    const numRows = result.toArray().length;
    const data: any[][] = [];
    for (let i = 0; i < numRows; i++) {
        const row: any[] = []; // row配列の初期化をここで行う
        for (let j = 0; j < headers.length; j++) {
            const column = result.getChildAt(j);
            row.push(column?.get(i));
        }
        data.push(row);
    }

    return (
        <div className='query-result'>
            <h3>Query Result:</h3>
            <table border='1'>
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index}>{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
