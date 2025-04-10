import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef, useState } from 'react';
import { geojsonToVectorTile } from '../utils/vectorTileUtils';

interface DuckDBConnection {
    query: (sql: string) => Promise<{
        numRows: number;
        toArray: () => Array<{ geojson: string }>;
    }>;
    close: () => Promise<void>;
}

interface MapProps {
    db: AsyncDuckDB;
    selectedTable: string | null;
    selectedColumns: string[];
}

interface TileParams {
    z: number;
    x: number;
    y: number;
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
}

interface QueryParams extends TileParams {
    selectedTable: string;
    selectedColumns: string[];
}

const calculateSimplifyTolerance = (zoomLevel: number): number => {
    // ズームレベル15以上は簡略化なし
    if (zoomLevel >= 15) return 0;

    // ズームレベル0から15までの範囲で、0.001から0まで線形に変化
    // ズームレベルが低いほど（広域表示）値が大きくなる
    const maxSimplify = 0.001;
    const minZoom = 0;
    const maxZoom = 15;

    // 線形補間: y = mx + b
    // m = (y2 - y1) / (x2 - x1)
    // ここでは x1=15, y1=0, x2=0, y2=0.001
    const m = (0 - maxSimplify) / (maxZoom - minZoom);
    const b = maxSimplify;

    const simplify = m * zoomLevel + b;

    return Number(simplify.toFixed(6));
};

const generateVectorTileQuery = (params: QueryParams): string => {
    const { z, minLng, maxLng, minLat, maxLat, selectedTable, selectedColumns } = params;
    const columns = selectedColumns.length > 0 ? selectedColumns.join(', ') : '1 as dummy';
    const simplify = calculateSimplifyTolerance(z);

    console.log(`z: ${z}, simplify level: ${simplify}`);

    return `
        SELECT 
            ST_AsGeoJSON(
                st_simplify(
                    ST_Intersection(geom, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat})),
                    -- geom,
                    ${simplify}
                )
            ) AS geojson,
            ${columns}
        FROM ${selectedTable}
        WHERE ST_Intersects(
            geom,
            ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat})
        )
    `;
};

const MapComponent: React.FC<MapProps> = ({ db, selectedTable, selectedColumns }) => {
    const [mapError, setMapError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const connectionRef = useRef<DuckDBConnection | null>(null);
    const tileCache = useRef<Map<string, Uint8Array>>(new Map());

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
                // 接続を保持
                connectionRef.current = await db.connect();
                if (!connectionRef.current) {
                    console.error('Failed to connect to DuckDB');
                    setMapError('DuckDBへの接続に失敗しました');
                    return;
                }

                // Add vector protocol handler
                maplibregl.addProtocol('duckdb-vector', async params => {
                    console.log('Protocol handler called with URL:', params.url);

                    // URLをデコード
                    const decodedUrl = decodeURIComponent(params.url);
                    console.log('Decoded URL:', decodedUrl);

                    // タイルパスの解析
                    const match = decodedUrl.match(/duckdb-vector:\/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
                    if (!match) {
                        console.error('Invalid tile path format:', decodedUrl);
                        return { data: new Uint8Array() };
                    }

                    const [z, x, y] = match.slice(1).map(Number);
                    const cacheKey = `${z}/${x}/${y}`;

                    // キャッシュをチェック
                    if (tileCache.current.has(cacheKey)) {
                        console.log('Using cached tile:', cacheKey);
                        return { data: tileCache.current.get(cacheKey) };
                    }

                    console.log(`Processing tile: z: ${z}, x: ${x}, y: ${y}`);

                    try {
                        if (!connectionRef.current) {
                            throw new Error('Database connection is not available');
                        }

                        const n = Math.pow(2, z);
                        const minLng = (x / n) * 360 - 180;
                        const maxLng = ((x + 1) / n) * 360 - 180;
                        const minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
                        const maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);

                        console.log(`Tile bounds: minLng=${minLng}, maxLng=${maxLng}, minLat=${minLat}, maxLat=${maxLat}`);

                        if (!selectedTable) {
                            console.log('No table selected');
                            return { data: new Uint8Array() };
                        }

                        // 選択されたカラムを取得するSQLクエリを構築
                        const query = generateVectorTileQuery({
                            z,
                            x,
                            y,
                            minLng,
                            maxLng,
                            minLat,
                            maxLat,
                            selectedTable,
                            selectedColumns,
                        });

                        console.log('Executing query:', query);
                        const result = await connectionRef.current.query(query);
                        console.log(`Query returned ${result.numRows} rows`);

                        if (result.numRows === 0) {
                            console.log('No data found for this tile');
                            return { data: new Uint8Array() };
                        }

                        const rows = result.toArray() as Array<{ geojson: string } & Record<string, string | number | null>>;
                        console.log('Raw data:', rows);

                        const features = rows
                            .map((row, index) => {
                                try {
                                    if (!row.geojson) {
                                        console.warn('Empty geojson for row:', row);
                                        return null;
                                    }
                                    const geometry = JSON.parse(row.geojson) as Geometry;
                                    console.log(`Parsed geometry ${index}:`, geometry);

                                    // 選択されたカラムの値をプロパティとして追加
                                    const properties: Record<string, string | number | null> = {};
                                    selectedColumns.forEach(column => {
                                        if (column in row) {
                                            properties[column] = row[column];
                                        }
                                    });

                                    return {
                                        type: 'Feature' as const,
                                        geometry: geometry,
                                        properties: properties,
                                    } as Feature<Geometry, GeoJsonProperties>;
                                } catch (error) {
                                    console.error('Error parsing GeoJSON:', error);
                                    return null;
                                }
                            })
                            .filter((feature): feature is Feature<Geometry, GeoJsonProperties> => feature !== null);

                        console.log('Processed features:', features);

                        if (features.length === 0) {
                            console.log('No valid features found');
                            return { data: new Uint8Array() };
                        }

                        console.log('Generating vector tile...');
                        const vectorTile = geojsonToVectorTile(features, z, x, y);
                        console.log('Vector tile generated, size:', vectorTile.length);

                        // キャッシュに保存
                        tileCache.current.set(cacheKey, vectorTile);
                        return { data: vectorTile };
                    } catch (error) {
                        console.error('Error processing tile:', error);
                        return { data: new Uint8Array() };
                    }
                });

                // マップの初期化
                const mapInstance = new maplibregl.Map({
                    container: 'map',
                    zoom: 7,
                    center: [139.7482, 35.6591], // 東京付近の座標
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
                                minzoom: 0,
                                maxzoom: 24,
                            },
                        },
                        layers: [
                            {
                                id: 'osm-layer',
                                source: 'osm',
                                type: 'raster',
                            },
                            {
                                id: 'duckdb-polygons',
                                source: 'duckdb-vector',
                                'source-layer': 'v',
                                type: 'fill',
                                paint: {
                                    'fill-color': '#ff6600',
                                    'fill-opacity': 0.5,
                                    'fill-outline-color': '#ff6600',
                                },
                                filter: ['==', '$type', 'Polygon'],
                                minzoom: 0,
                                maxzoom: 24,
                            },
                            {
                                id: 'duckdb-lines',
                                source: 'duckdb-vector',
                                'source-layer': 'v',
                                type: 'line',
                                paint: {
                                    'line-color': '#ff6600',
                                    'line-width': 2,
                                    'line-opacity': 0.8,
                                },
                                filter: ['==', '$type', 'LineString'],
                                minzoom: 0,
                                maxzoom: 24,
                            },
                            {
                                id: 'duckdb-points',
                                source: 'duckdb-vector',
                                'source-layer': 'v',
                                type: 'circle',
                                paint: {
                                    'circle-radius': 6,
                                    'circle-color': '#ff0000',
                                    'circle-stroke-width': 1,
                                    'circle-stroke-color': '#ffffff',
                                },
                                filter: ['==', '$type', 'Point'],
                                minzoom: 0,
                                maxzoom: 24,
                            },
                        ],
                    },
                });

                // マップの読み込み完了時の処理
                mapInstance.on('load', () => {
                    console.log('マップ読み込み完了');
                    setIsLoading(false);

                    // ポップアップの作成
                    const popup = new maplibregl.Popup({
                        closeButton: true,
                        closeOnClick: true,
                        offset: 25,
                    });

                    // クリックイベントの共通処理
                    const handleFeatureClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
                        if (!e.features?.[0]) return;

                        const feature = e.features[0];
                        const geometry = feature.geometry as GeoJSON.Geometry;
                        const properties = feature.properties;

                        // クリック位置の座標を取得
                        const coordinates = e.lngLat;

                        // ジオメトリタイプに応じた情報を取得
                        let geometryInfo = '';
                        if (geometry.type === 'Point') {
                            const point = geometry as GeoJSON.Point;
                            geometryInfo = `
                                <p>緯度: ${point.coordinates[1].toFixed(6)}</p>
                                <p>経度: ${point.coordinates[0].toFixed(6)}</p>
                            `;
                        } else if (geometry.type === 'LineString') {
                            const line = geometry as GeoJSON.LineString;
                            geometryInfo = `
                                <p>クリック位置:</p>
                                <p>緯度: ${coordinates.lat.toFixed(6)}</p>
                                <p>経度: ${coordinates.lng.toFixed(6)}</p>
                                <p>頂点数: ${line.coordinates.length}</p>
                            `;
                        } else if (geometry.type === 'Polygon') {
                            const polygon = geometry as GeoJSON.Polygon;
                            const totalVertices = polygon.coordinates.reduce((sum, ring) => sum + ring.length, 0);
                            geometryInfo = `
                                <p>クリック位置:</p>
                                <p>緯度: ${coordinates.lat.toFixed(6)}</p>
                                <p>経度: ${coordinates.lng.toFixed(6)}</p>
                                <p>リング数: ${polygon.coordinates.length}</p>
                                <p>頂点数: ${totalVertices}</p>
                            `;
                        }

                        // 選択されたカラムの情報を取得
                        let columnInfo = '';
                        if (selectedColumns.length > 0) {
                            columnInfo = `
                                <div style="margin-top: 10px;">
                                    <h4>カラム情報</h4>
                                    ${selectedColumns
                                        .map(column => {
                                            const value = properties?.[column];
                                            return `<p>${column}: ${value !== undefined ? value : 'N/A'}</p>`;
                                        })
                                        .join('')}
                                </div>
                            `;
                        }

                        // ポップアップの内容を設定
                        const content = `
                            <div style="padding: 10px;">
                                <h3>${geometry.type} 情報</h3>
                                ${geometryInfo}
                                ${columnInfo}
                            </div>
                        `;

                        // ポップアップを表示
                        popup.setLngLat(coordinates).setHTML(content).addTo(mapInstance);
                    };

                    // 各レイヤーのクリックイベントを追加
                    mapInstance.on('click', 'duckdb-points', handleFeatureClick);
                    mapInstance.on('click', 'duckdb-lines', handleFeatureClick);
                    mapInstance.on('click', 'duckdb-polygons', handleFeatureClick);

                    // ホバー効果の共通処理
                    const handleMouseEnter = () => {
                        mapInstance.getCanvas().style.cursor = 'pointer';
                    };

                    const handleMouseLeave = () => {
                        mapInstance.getCanvas().style.cursor = '';
                    };

                    // 各レイヤーのホバー効果を追加
                    mapInstance.on('mouseenter', 'duckdb-points', handleMouseEnter);
                    mapInstance.on('mouseenter', 'duckdb-lines', handleMouseEnter);
                    mapInstance.on('mouseenter', 'duckdb-polygons', handleMouseEnter);

                    mapInstance.on('mouseleave', 'duckdb-points', handleMouseLeave);
                    mapInstance.on('mouseleave', 'duckdb-lines', handleMouseLeave);
                    mapInstance.on('mouseleave', 'duckdb-polygons', handleMouseLeave);
                });

                // クリーンアップ関数
                return () => {
                    if (mapInstance) {
                        mapInstance.remove();
                    }
                    if (connectionRef.current) {
                        connectionRef.current.close();
                    }
                };
            } catch (error) {
                console.error('Error initializing map:', error);
                setMapError(`マップ初期化エラー: ${error instanceof Error ? error.message : String(error)}`);
                setIsLoading(false);
            }
        };

        initMap();
    }, [db, selectedTable, selectedColumns]);

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

export default MapComponent;
