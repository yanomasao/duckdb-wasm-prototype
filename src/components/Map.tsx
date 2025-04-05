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
                                    const rasterData = await geojsonToRaster(features, z, x, y);
                                    resolve({ data: rasterData });
                                } catch (error) {
                                    console.error('Error converting to Raster:', error);
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
                            sources: {
                                osm: {
                                    type: 'raster',
                                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                    maxzoom: 19,
                                    tileSize: 256,
                                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                                },
                                'duckdb-raster': {
                                    type: 'raster',
                                    tiles: ['duckdb-raster://{z}/{x}/{y}.png'],
                                    maxzoom: 19,
                                    tileSize: 256,
                                    minzoom: 0,
                                    scheme: 'xyz',
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
                                    source: 'duckdb-raster',
                                    type: 'raster',
                                    paint: {
                                        'raster-opacity': 0.5,
                                        'raster-fade-duration': 0,
                                    },
                                },
                            ],
                        },
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
