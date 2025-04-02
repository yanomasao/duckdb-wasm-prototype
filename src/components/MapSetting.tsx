import React, { useState } from 'react';

interface MapSettingProps {
    onUpdate: (zoom: number, lat: number, lng: number) => void;
}

const MapSetting: React.FC<MapSettingProps> = ({ onUpdate }) => {
    const [zoom, setZoom] = useState<number>(10);
    const [lat, setLat] = useState<number>(35.7);
    const [lng, setLng] = useState<number>(139.7);

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

    return (
        <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
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
            </div>
        </div>
    );
};

export default MapSetting; 