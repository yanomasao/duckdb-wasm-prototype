import { useState } from "react";

interface DuckDbQueryProps {
    onExecute: (query: string) => Promise<void>;
    disabled: boolean;
}

export function DuckDbQuery({ onExecute, disabled }: DuckDbQueryProps) {
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
            <button type='submit' disabled={disabled || !query.trim()}>
                Execute Query
            </button>
        </form>
    );
}
