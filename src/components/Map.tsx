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
        console.log('マップ初期化開始');

        // DuckDBの初期化状態を確認
        if (db) {
            setMapError(null);
        } else {
            console.error('DuckDB is not initialized');
            return;
        }

        // DuckDBの接続を確認
        const initMap = async () => {
            try {
                const conn = await db.connect();
                if (!conn) {
                    console.error('Failed to connect to DuckDB');
                    setMapError('DuckDBへの接続に失敗しました');
                    return;
                }
                conn.close();

                // Add vector protocol handler
                maplibregl.addProtocol('duckdb-vector', async (params, abortController) => {
                    console.log('Protocol handler called with URL:', params.url);

                    // URLをデコード
                    const decodedUrl = decodeURIComponent(params.url);
                    console.log('Decoded URL:', decodedUrl);

                    if (decodedUrl === 'duckdb-vector://{z}/{x}/{y}.pbf') {
                        console.log('Template URL detected, returning empty data');
                        return { data: new Uint8Array() };
                    }

                    // タイルパスの解析
                    const match = decodedUrl.match(/duckdb-vector:\/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
                    if (!match) {
                        console.error('Invalid tile path format:', decodedUrl);
                        return { data: new Uint8Array() };
                    }

                    const [z, x, y] = match.slice(1).map(Number);
                    console.log(`Processing tile: z: ${z}, x: ${x}, y: ${y}`);

                    return new Promise((resolve, reject) => {
                        const processTile = async () => {
                            try {
                                const conn = await db.connect();
                                if (!conn) {
                                    console.warn('DuckDB not ready');
                                    reject(new Error('DB not ready'));
                                    return;
                                }

                                const minLng = (x / Math.pow(2, z)) * 360 - 180;
                                const maxLng = ((x + 1) / Math.pow(2, z)) * 360 - 180;
                                const minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / Math.pow(2, z)))) * (180 / Math.PI);
                                const maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / Math.pow(2, z)))) * (180 / Math.PI);

                                const query = `
                                    SELECT ST_AsGeoJSON(geom) AS geojson
                                    FROM tokyo
                                    WHERE ST_Intersects(
                                        geom,
                                        ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat})
                                    )
                                `;

                                console.log('Executing query:', query);
                                const result = await conn.query(query);

                                if (result.numRows === 0) {
                                    console.log('No data found for this tile');
                                    resolve({ data: new Uint8Array() });
                                    return;
                                }

                                const rows = result.toArray();
                                console.log('Raw rows:', rows);

                                const features = rows
                                    .map((row, index) => {
                                        try {
                                            if (!row.geojson) {
                                                console.warn('Empty geojson for row:', row);
                                                return null;
                                            }
                                            console.log('Raw geojson string:', row.geojson);
                                            const geometry = JSON.parse(row.geojson) as Geometry;
                                            console.log('Parsed geometry:', geometry);
                                            return {
                                                type: 'Feature' as const,
                                                geometry: geometry,
                                                properties: {
                                                    id: index,
                                                },
                                            } as Feature<Geometry, GeoJsonProperties>;
                                        } catch (error) {
                                            console.error('Error parsing GeoJSON:', error);
                                            console.error('Problematic row:', row);
                                            return null;
                                        }
                                    })
                                    .filter((feature): feature is Feature<Geometry, GeoJsonProperties> => feature !== null);

                                if (features.length === 0) {
                                    console.log('No valid features found');
                                    resolve({ data: new Uint8Array() });
                                    return;
                                }

                                try {
                                    const vectorTile = geojsonToVectorTile(features, z, x, y);
                                    resolve({ data: vectorTile });
                                } catch (error) {
                                    console.error('Error converting to Vector Tile:', error);
                                    resolve({ data: new Uint8Array() });
                                }
                            } catch (error) {
                                console.error('Error:', error);
                                reject(error);
                            } finally {
                                conn?.close();
                            }
                        };

                        processTile().catch(reject);
                    });
                });

                try {
                    // マップの初期化
                    const mapInstance = new maplibregl.Map({
                        container: 'map',
                        zoom: 5,
                        center: [139.7, 35.7],
                        style: {
                            version: 8,
                            glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                            sources: {
                                osm: {
                                    type: 'raster',
                                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                    maxzoom: 19,
                                    tileSize: 256,
                                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                                },
                                'duckdb-vector': {
                                    type: 'vector',
                                    tiles: ['duckdb-vector://{z}/{x}/{y}.pbf'],
                                    maxzoom: 19,
                                    minzoom: 0,
                                },
                            },
                            layers: [
                                {
                                    id: 'osm-layer',
                                    source: 'osm',
                                    type: 'raster',
                                },
                                {
                                    id: 'duckdb-layer',
                                    source: 'duckdb-vector',
                                    'source-layer': 'features',
                                    type: 'fill',
                                    paint: {
                                        'fill-color': '#FF6600',
                                        'fill-opacity': 0.2,
                                    },
                                },
                                {
                                    id: 'duckdb-markers',
                                    source: 'duckdb-vector',
                                    'source-layer': 'features',
                                    type: 'symbol',
                                    paint: {
                                        'text-color': '#000000',
                                    },
                                    layout: {
                                        'text-field': ['get', 'name'],
                                        'text-size': 12,
                                        'text-offset': [0, 1],
                                        'text-anchor': 'top',
                                    },
                                },
                            ],
                        },
                    });

                    // マップの読み込み完了時の処理
                    mapInstance.on('load', () => {
                        console.log('マップ読み込み完了');
                        setIsLoading(false);
                    });

                    // マップのエラー処理
                    mapInstance.on('error', e => {
                        console.error('マップエラー:', e);
                        setMapError(`マップエラー: ${e.error?.message || '不明なエラー'}`);
                    });

                    // マップのスタイル読み込み完了時の処理
                    mapInstance.on('style.load', () => {
                        console.log('マップスタイル読み込み完了');
                    });

                    // クリーンアップ関数
                    return () => {
                        if (mapInstance) {
                            mapInstance.remove();
                        }
                    };
                } catch (error) {
                    console.error('マップ初期化エラー:', error);
                    setMapError(`マップ初期化エラー: ${error instanceof Error ? error.message : String(error)}`);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error connecting to DuckDB:', error);
                setMapError(`DuckDB接続エラー: ${error instanceof Error ? error.message : String(error)}`);
                return;
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
