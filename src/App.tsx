import { useState } from 'react';
import './App.css';
import LocalFiles from './components/LocalFiles';
import MapComponent from './components/Map';
import RemoteResources from './components/RemoteResources';
import { useDuckDB } from './hooks/useDuckDB';
import TableList from './components/TableList';

function App() {
    const { db, error: dbError } = useDuckDB();
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [showTableList, setShowTableList] = useState(false);
    const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({});

    const handleColumnSelect = (tableName: string, columns: string[]) => {
        setSelectedColumns(prev => ({
            ...prev,
            [tableName]: columns,
        }));
    };

    return (
        <>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {db && <RemoteResources db={db} onTableCreated={() => setShowTableList(true)} />}
                {db && <LocalFiles db={db} onTableCreated={() => setShowTableList(true)} />}
                {db && (
                    <TableList
                        db={db}
                        selectedTable={selectedTable}
                        onTableSelect={setSelectedTable}
                        selectedColumns={selectedColumns}
                        onColumnSelect={handleColumnSelect}
                    />
                )}
            </div>
            {db && (
                <MapComponent
                    key={selectedTable || 'no-table'}
                    db={db}
                    selectedTable={selectedTable}
                    selectedColumns={selectedColumns[selectedTable || ''] || []}
                />
            )}
        </>
    );
}

export default App;
