import * as duckdb from "@duckdb/duckdb-wasm";
import React, { useState } from "react";

interface TableListProps {
    tables: string[];
    selectedTables: string[];
    onTableSelect: (tableName: string) => void;
    db: duckdb.AsyncDuckDB | null;
    onColumnAliasChange: (
        tableName: string,
        columnName: string,
        alias: string
    ) => void;
    onTableDelete: (tableName: string) => void;
}

interface ColumnInfo {
    name: string;
    selected: boolean;
    alias: string;
}

export const TableList: React.FC<TableListProps> = ({
    tables,
    selectedTables,
    onTableSelect,
    db,
    onColumnAliasChange,
    onTableDelete,
}) => {
    const [expandedTable, setExpandedTable] = useState<string | null>(null);
    const [columns, setColumns] = useState<{ [key: string]: ColumnInfo[] }>({});
    const [editingAlias, setEditingAlias] = useState<{
        table: string;
        column: string;
    } | null>(null);
    const [aliasText, setAliasText] = useState("");

    const handleTableClick = async (tableName: string) => {
        if (!db) return;

        try {
            const conn = await db.connect();
            const result = await conn.query(`DESCRIBE ${tableName};`);
            const columnNames: ColumnInfo[] = [];
            for (let i = 0; i < result.numRows; i++) {
                columnNames.push({
                    name: result.getChildAt(0)?.get(i) as string,
                    selected: false,
                    alias: "",
                });
            }
            setColumns((prev) => ({
                ...prev,
                [tableName]: columnNames,
            }));
            await conn.close();

            if (expandedTable === tableName) {
                setExpandedTable(null);
            } else {
                setExpandedTable(tableName);
            }
        } catch (err) {
            console.error("Error fetching columns:", err);
        }
    };

    const handleColumnSelect = (tableName: string, columnName: string) => {
        setColumns((prev) => ({
            ...prev,
            [tableName]: prev[tableName].map((col) =>
                col.name === columnName
                    ? { ...col, selected: !col.selected }
                    : col
            ),
        }));
    };

    const handleAliasEdit = (
        tableName: string,
        columnName: string,
        currentAlias: string
    ) => {
        setEditingAlias({ table: tableName, column: columnName });
        setAliasText(currentAlias);
    };

    const handleAliasSave = () => {
        if (editingAlias) {
            setColumns((prev) => ({
                ...prev,
                [editingAlias.table]: prev[editingAlias.table].map((col) =>
                    col.name === editingAlias.column
                        ? { ...col, alias: aliasText }
                        : col
                ),
            }));
            onColumnAliasChange(
                editingAlias.table,
                editingAlias.column,
                aliasText
            );
            setEditingAlias(null);
        }
    };

    return (
        <div className='table-list'>
            <h3>テーブル一覧</h3>
            <div className='table-checkboxes'>
                {tables.map((table) => (
                    <div key={table} className='table-item'>
                        <div className='table-header'>
                            <label className='table-checkbox'>
                                <input
                                    type='checkbox'
                                    checked={selectedTables.includes(table)}
                                    onChange={() => onTableSelect(table)}
                                />
                                <span
                                    className='table-name'
                                    onClick={() => handleTableClick(table)}
                                >
                                    {table}
                                    {expandedTable === table && (
                                        <span className='expand-icon'>▼</span>
                                    )}
                                </span>
                            </label>
                            <button
                                onClick={() => onTableDelete(table)}
                                style={{
                                    fontSize: "12px",
                                    padding: "2px 4px",
                                    backgroundColor: "#ff4444",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "3px",
                                    cursor: "pointer",
                                    marginLeft: "8px",
                                }}
                            >
                                削除
                            </button>
                        </div>
                        {expandedTable === table && (
                            <div className='column-list'>
                                {columns[table]?.map((column) => (
                                    <div
                                        key={column.name}
                                        className='column-item'
                                    >
                                        <label className='column-checkbox'>
                                            <input
                                                type='checkbox'
                                                checked={column.selected}
                                                onChange={() =>
                                                    handleColumnSelect(
                                                        table,
                                                        column.name
                                                    )
                                                }
                                            />
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                }}
                                            >
                                                {column.name}
                                                {editingAlias?.table ===
                                                    table &&
                                                editingAlias?.column ===
                                                    column.name ? (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            gap: "4px",
                                                        }}
                                                    >
                                                        <input
                                                            type='text'
                                                            value={aliasText}
                                                            onChange={(e) =>
                                                                setAliasText(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder='エイリアス'
                                                            style={{
                                                                fontSize:
                                                                    "12px",
                                                                padding:
                                                                    "2px 4px",
                                                            }}
                                                        />
                                                        <button
                                                            onClick={
                                                                handleAliasSave
                                                            }
                                                            style={{
                                                                fontSize:
                                                                    "12px",
                                                                padding:
                                                                    "2px 4px",
                                                            }}
                                                        >
                                                            保存
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                setEditingAlias(
                                                                    null
                                                                )
                                                            }
                                                            style={{
                                                                fontSize:
                                                                    "12px",
                                                                padding:
                                                                    "2px 4px",
                                                            }}
                                                        >
                                                            キャンセル
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: "4px",
                                                        }}
                                                    >
                                                        {column.alias && (
                                                            <span
                                                                style={{
                                                                    fontSize:
                                                                        "12px",
                                                                    color: "#666",
                                                                }}
                                                            >
                                                                as{" "}
                                                                {column.alias}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() =>
                                                                handleAliasEdit(
                                                                    table,
                                                                    column.name,
                                                                    column.alias
                                                                )
                                                            }
                                                            style={{
                                                                fontSize:
                                                                    "12px",
                                                                padding:
                                                                    "2px 4px",
                                                            }}
                                                        >
                                                            編集
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
