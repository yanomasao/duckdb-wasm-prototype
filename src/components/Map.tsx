import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useState } from 'react';
import { geojsonToVectorTile } from '../utils/vectorTileUtils';

const Map: React.FC<{ db: AsyncDuckDB }> = ({ db }) => {
    const [mapError, setMapError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const initMap = async () => {
            try {
                // カスタムプロトコルハンドラの追加
                maplibregl.addProtocol('vector', async params => {
                    try {
                        const url = params.url;
                        const match = url.match(/vector:\/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
                        if (!match) {
                            return { data: new Uint8Array() };
                        }

                        const [z, x, y] = match.slice(1).map(Number);
                        console.log('Requesting tile:', { z, x, y });

                        // タイル座標から地理座標への変換をデバッグ
                        // const minLng = (x / Math.pow(2, z)) * 360 - 180;
                        // const minLat = (1 - (y + 1) / Math.pow(2, z)) * 180 - 90;
                        // const maxLng = ((x + 1) / Math.pow(2, z)) * 360 - 180;
                        // const maxLat = (1 - y / Math.pow(2, z)) * 180 - 90;
                        const minLng = (x / Math.pow(2, z)) * 360 - 180;
                        const maxLng = ((x + 1) / Math.pow(2, z)) * 360 - 180;
                        const minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / Math.pow(2, z)))) * (180 / Math.PI);
                        const maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / Math.pow(2, z)))) * (180 / Math.PI);

                        console.log('Calculated bounds:', {
                            minLng,
                            minLat,
                            maxLng,
                            maxLat,
                        });

                        // DuckDBからデータを取得
                        const conn = await db.connect();
                        const query = `
                            SELECT 
                                ST_AsGeoJSON(geom) AS geojson,
                                'foo' as name
                            FROM tokyo
                            WHERE ST_Intersects(
                                geom,
                                ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat})
                                )
                            
                        `;
                        console.log('Executing query:', query);
                        const result = await conn.query(query);
                        const rows = result.toArray();
                        console.log('Number of rows:', rows.length);
                        if (rows.length > 0) {
                            console.log('First row:', rows[0]);
                        }

                        const features = rows.map((row, index) => {
                            const geometry = JSON.parse(row.geojson) as Geometry;
                            console.log(`Feature ${index} geometry:`, geometry);
                            return {
                                type: 'Feature' as const,
                                geometry: geometry,
                                properties: {
                                    id: index,
                                    name: row.name || 'Unknown',
                                },
                            } as Feature<Geometry, GeoJsonProperties>;
                        });

                        console.log('Generated features:', features);
                        const vectorTile = await geojsonToVectorTile(features, z, x, y);
                        console.log('Vector tile size:', vectorTile.length);
                        console.log('Vector tile content:', new Uint8Array(vectorTile));

                        // マップのレイヤーが正しく読み込まれたか確認
                        map.once('sourcedata', e => {
                            if (e.sourceId === 'vector') {
                                console.log('Vector source loaded:', e);
                            }
                        });

                        return { data: vectorTile };
                    } catch (error) {
                        console.error('Error in vector tile protocol:', error);
                        return { data: new Uint8Array() };
                    }
                });

                // マップの初期化
                const map = new maplibregl.Map({
                    container: 'map',
                    style: {
                        version: 8,
                        sources: {
                            'osm-tiles': {
                                type: 'raster',
                                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                tileSize: 256,
                                attribution: '© OpenStreetMap contributors',
                            },
                            vector: {
                                type: 'vector',
                                tiles: ['vector://{z}/{x}/{y}.pbf'],
                                minzoom: 0,
                                maxzoom: 14,
                                scheme: 'xyz',
                                promoteId: 'id',
                            },
                        },
                        layers: [
                            {
                                id: 'osm-tiles',
                                type: 'raster',
                                source: 'osm-tiles',
                                minzoom: 0,
                                maxzoom: 19,
                            },
                            {
                                id: 'points',
                                type: 'circle',
                                source: 'vector',
                                'source-layer': 'features',
                                paint: {
                                    'circle-radius': 8,
                                    'circle-color': '#FF0000',
                                    'circle-opacity': 0.8,
                                    'circle-stroke-width': 2,
                                    'circle-stroke-color': '#FFFFFF',
                                },
                                filter: ['==', '$type', 'Point'],
                                minzoom: 0,
                                maxzoom: 14,
                            },
                        ],
                    },
                    center: [139.6917, 35.6895],
                    zoom: 10,
                });

                // マップの読み込み完了時の処理
                map.on('load', () => {
                    console.log('Map loaded');
                    setIsLoading(false);

                    // ベクトルソースの読み込み状態を監視
                    map.on('sourcedata', e => {
                        if (e.sourceId === 'vector') {
                            console.log('Vector source data event:', e);
                            if (e.isSourceLoaded) {
                                console.log('Vector source loaded successfully');
                            }
                        }
                    });

                    // レイヤーの読み込み状態を監視
                    map.on('layerload', e => {
                        if (e.layerId === 'points') {
                            console.log('Points layer loaded successfully');
                        }
                    });
                });

                // エラー処理
                map.on('error', e => {
                    console.error('Map error:', e);
                });

                return () => {
                    map.remove();
                };
            } catch (error) {
                console.error('Error initializing map:', error);
                setMapError(error instanceof Error ? error.message : String(error));
                setIsLoading(false);
            }
        };

        initMap();
    }, [db]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <div
                id="map"
                style={{
                    height: '90%',
                    aspectRatio: '1/1',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            ></div>
            {isLoading && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        padding: '10px',
                        borderRadius: '5px',
                    }}
                >
                    マップを読み込み中...
                </div>
            )}
            {mapError && (
                <div
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        background: 'rgba(255, 0, 0, 0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '5px',
                        maxWidth: '80%',
                    }}
                >
                    エラー: {mapError}
                </div>
            )}
        </div>
    );
};

export default Map;
