import React, { useState } from 'react';

interface MapSettingProps {
    onUpdate: (zoom: number, lat: number, lng: number) => void;
    showTile: boolean;
    onShowTileChange: (show: boolean) => void;
}

const MapSetting: React.FC<MapSettingProps> = ({ onUpdate, showTile, onShowTileChange }) => {
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

    const handleShowTileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onShowTileChange(e.target.checked);
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
                <div>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={showTile}
                            onChange={handleShowTileChange}
                            style={{ margin: 0 }}
                        />
                        <span>タイルを表示</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default MapSetting; 