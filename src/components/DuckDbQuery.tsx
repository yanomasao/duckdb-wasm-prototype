import { useState } from "react";

interface DuckDbQueryProps {
    onExecute: (query: string) => Promise<void>;
    onShowTables: () => Promise<void>;
    disabled: boolean;
}

export function DuckDbQuery({
    onExecute,
    onShowTables,
    disabled,
}: DuckDbQueryProps) {
    const [query, setQuery] = useState(
        `SELECT 'Hello from DuckDB-WASM!' as greeting`
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onExecute(query);
    };

    return (
        <form onSubmit={handleSubmit} className='query-form'>
            <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Enter SQL query...'
                rows={5}
                disabled={disabled}
            />
            <div className='query-buttons'>
                <button type='submit' disabled={disabled || !query.trim()}>
                    Execute Query
                </button>
                <button
                    type='button'
                    onClick={onShowTables}
                    disabled={disabled}
                >
                    Show Tables
                </button>
            </div>
        </form>
    );
}
