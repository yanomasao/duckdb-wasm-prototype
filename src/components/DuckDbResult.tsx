interface DuckDbResultProps {
    result: any | null;
    error: string | null;
}

export function DuckDbResult({ result, error }: DuckDbResultProps) {
    if (error) {
        return <div className='query-error'>Error: {error}</div>;
    }

    if (!result) {
        return null;
    }

    return (
        <div className='query-result'>
            <h3>Query Result:</h3>
            <pre>{result.toString()}</pre>
        </div>
    );
}
