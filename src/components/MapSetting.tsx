import React, { useEffect, useState } from 'react';

interface MapSettingProps {
    onUpdate: (zoom: number, lat: number, lng: number) => void;
}

const MapSetting: React.FC<MapSettingProps> = ({ onUpdate }) => {
    const [zoom, setZoom] = useState<number>(10);
    const [lat, setLat] = useState<number>(35.7);
    const [lng, setLng] = useState<number>(139.7);

    // 初期レンダリング時のみ実行
    useEffect(() => {
        onUpdate(zoom, lat, lng);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 値が変更されたときにonUpdateを呼び出す
    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newZoom = Number(e.target.value);
        setZoom(newZoom);
        onUpdate(newZoom, lat, lng);
    };

    const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newLat = Number(e.target.value);
        setLat(newLat);
        onUpdate(zoom, newLat, lng);
    };

    const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newLng = Number(e.target.value);
        setLng(newLng);
        onUpdate(zoom, lat, newLng);
    };

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
                        onChange={handleZoomChange}
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
                        onChange={handleLatChange}
                        step="0.1"
                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <div>
                    <label htmlFor="lng" style={{ display: 'block', marginBottom: '5px' }}>経度:</label>
                    <input
                        type="number"
                        id="lng"
                        value={lng}
                        onChange={handleLngChange}
                        step="0.1"
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

export default MapSetting; 