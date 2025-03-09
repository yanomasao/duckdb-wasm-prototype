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
    onTableConditionChange: (tableName: string, condition: string) => void;
    onShowTableData: (tableName: string) => void;
    onColumnSelect: (
        tableName: string,
        columnName: string,
        selected: boolean
    ) => void;
    columnStates: { [key: string]: ColumnInfo[] };
    setColumnStates: React.Dispatch<
        React.SetStateAction<{ [key: string]: ColumnInfo[] }>
    >;
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
    onTableConditionChange,
    onShowTableData,
    onColumnSelect,
    columnStates,
    setColumnStates,
}) => {
    const [expandedTable, setExpandedTable] = useState<string | null>(null);
    const [editingAlias, setEditingAlias] = useState<{
        table: string;
        column: string;
    } | null>(null);
    const [aliasText, setAliasText] = useState("");
    const [tableConditions, setTableConditions] = useState<{
        [key: string]: string;
    }>({});

    const handleTableClick = async (tableName: string) => {
        if (!db) return;

        if (expandedTable === tableName) {
            setExpandedTable(null);
        } else {
            setExpandedTable(tableName);
            if (!columnStates[tableName]) {
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
            }
        }
    };

    const handleColumnSelect = (tableName: string, columnName: string) => {
        const currentSelected =
            columnStates[tableName]?.find((col) => col.name === columnName)
                ?.selected || false;
        onColumnSelect(tableName, columnName, !currentSelected);
    };

    const handleAliasSave = () => {
        if (editingAlias) {
            onColumnAliasChange(
                editingAlias.table,
                editingAlias.column,
                aliasText
            );
            setEditingAlias(null);
        }
    };

    const handleConditionChange = (tableName: string, condition: string) => {
        setTableConditions((prev) => ({
            ...prev,
            [tableName]: condition,
        }));
        onTableConditionChange(tableName, condition);
    };

    return (
        <div className='table-list'>
            <h3>テーブル一覧</h3>
            <div className='table-checkboxes'>
                {tables.map((table) => (
                    <div key={table} className='table-item'>
                        <div className='table-header'>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <input
                                    type='checkbox'
                                    checked={selectedTables.includes(table)}
                                    onChange={() => onTableSelect(table)}
                                    style={{ margin: 0 }}
                                />
                                <span
                                    className='table-name'
                                    onClick={() => handleTableClick(table)}
                                    style={{ cursor: "pointer" }}
                                >
                                    {table}
                                    {expandedTable === table && (
                                        <span className='expand-icon'>▼</span>
                                    )}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    marginLeft: "8px",
                                }}
                            >
                                <button
                                    onClick={() => onShowTableData(table)}
                                    style={{
                                        fontSize: "12px",
                                        padding: "2px 4px",
                                        backgroundColor: "#4CAF50",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "3px",
                                        cursor: "pointer",
                                    }}
                                >
                                    一覧
                                </button>
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
                                    }}
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                        {expandedTable === table && (
                            <>
                                <div className='column-list'>
                                    {columnStates[table]?.map((column) => (
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
                                                                value={
                                                                    aliasText
                                                                }
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
                                                                    {
                                                                        column.alias
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                <div
                                    className='condition-input'
                                    style={{
                                        marginTop: "8px",
                                        padding: "8px",
                                        backgroundColor: "#f5f5f5",
                                        borderRadius: "4px",
                                    }}
                                >
                                    <label
                                        style={{
                                            display: "block",
                                            fontSize: "12px",
                                            marginBottom: "4px",
                                        }}
                                    >
                                        条件 (WHERE句):
                                    </label>
                                    <input
                                        type='text'
                                        value={tableConditions[table] || ""}
                                        onChange={(e) =>
                                            handleConditionChange(
                                                table,
                                                e.target.value
                                            )
                                        }
                                        placeholder='例: name LIKE "%駅%"'
                                        style={{
                                            width: "100%",
                                            fontSize: "12px",
                                            padding: "4px",
                                            border: "1px solid #ddd",
                                            borderRadius: "3px",
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
