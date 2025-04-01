import React, { useState } from 'react';

interface TileProps {
    onUpdate: (zoom: number, lat: number, lng: number) => void;
}

const Tile: React.FC<TileProps> = ({ onUpdate }) => {
    const [zoom, setZoom] = useState<number>(10);
    const [lat, setLat] = useState<number>(35.0);
    const [lng, setLng] = useState<number>(138.9);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate(zoom, lat, lng);
    };

    return (
        <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div>
                    <label htmlFor="zoom" style={{ display: 'block', marginBottom: '5px' }}>ズームレベル:</label>
                    <input
                        type="number"
                        id="zoom"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        min="0"
                        max="22"
                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <div>
                    <label htmlFor="lat" style={{ display: 'block', marginBottom: '5px' }}>緯度:</label>
                    <input
                        type="number"
                        id="lat"
                        value={lat}
                        onChange={(e) => setLat(Number(e.target.value))}
                        step="0.0001"
                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <div>
                    <label htmlFor="lng" style={{ display: 'block', marginBottom: '5px' }}>経度:</label>
                    <input
                        type="number"
                        id="lng"
                        value={lng}
                        onChange={(e) => setLng(Number(e.target.value))}
                        step="0.0001"
                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <button
                    type="submit"
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#646cff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '20px'
                    }}
                >
                    更新
                </button>
            </form>
        </div>
    );
};

export default Tile; 