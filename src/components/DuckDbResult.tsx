import { Table } from "apache-arrow";
import { useState } from "react";

interface DuckDbResultProps {
    result: Table | null;
    error: string | null;
}

interface ColumnDescription {
    [key: string]: string;
}

export function DuckDbResult({ result, error }: DuckDbResultProps) {
    const [columnDescriptions, setColumnDescriptions] =
        useState<ColumnDescription>({});
    const [editingColumn, setEditingColumn] = useState<string | null>(null);
    const [editText, setEditText] = useState("");

    console.log("DuckDbResult", result, error);
    if (error) {
        return <div className='query-error'>Error: {error}</div>;
    }

    if (!result) {
        return null;
    }

    const headers = result.schema.fields.map((field) => field.name);
    console.log("headers", headers);
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

    const handleDescriptionEdit = (header: string) => {
        setEditingColumn(header);
        setEditText(columnDescriptions[header] || "");
    };

    const handleDescriptionSave = () => {
        if (editingColumn) {
            setColumnDescriptions((prev) => ({
                ...prev,
                [editingColumn]: editText,
            }));
            setEditingColumn(null);
        }
    };

    return (
        <div className='query-result'>
            <h3>Query Result:</h3>
            <table border='1'>
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    {header}
                                    {editingColumn === header ? (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "4px",
                                            }}
                                        >
                                            <input
                                                type='text'
                                                value={editText}
                                                onChange={(e) =>
                                                    setEditText(e.target.value)
                                                }
                                                style={{
                                                    fontSize: "12px",
                                                    padding: "2px 4px",
                                                }}
                                            />
                                            <button
                                                onClick={handleDescriptionSave}
                                                style={{
                                                    fontSize: "12px",
                                                    padding: "2px 4px",
                                                }}
                                            >
                                                保存
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setEditingColumn(null)
                                                }
                                                style={{
                                                    fontSize: "12px",
                                                    padding: "2px 4px",
                                                }}
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                            }}
                                        >
                                            {columnDescriptions[header] && (
                                                <span
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#666",
                                                    }}
                                                >
                                                    (
                                                    {columnDescriptions[header]}
                                                    )
                                                </span>
                                            )}
                                            <button
                                                onClick={() =>
                                                    handleDescriptionEdit(
                                                        header
                                                    )
                                                }
                                                style={{
                                                    fontSize: "12px",
                                                    padding: "2px 4px",
                                                }}
                                            >
                                                編集
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </th>
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

    // return (
    //     <div className='query-result'>
    //         <h3>Query Result:</h3>
    //         <pre>{result.toString()}</pre>
    //     </div>
    // );
}
