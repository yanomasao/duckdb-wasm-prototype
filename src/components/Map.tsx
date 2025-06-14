import { AsyncDuckDB, AsyncPreparedStatement } from '@duckdb/duckdb-wasm';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef, useState } from 'react';
import { getTileEnvelope, getZxyFromUrl } from '../utils/tileUtils';
import { geojsonToVectorTile } from '../utils/vectorTileUtils';

interface DuckDBConnection {
    query: (sql: string) => Promise<{
        numRows: number;
        toArray: () => Array<{ geojson: string }>;
    }>;
    prepare: (sql: string) => Promise<AsyncPreparedStatement>;
    close: () => Promise<void>;
}

interface MapProps {
    db: AsyncDuckDB;
    selectedTable: string | null;
    selectedColumns: string[];
}

interface QueryParams {
    zxy: {
        z: number;
        x: number;
        y: number;
    };
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
    const { zxy, selectedTable, selectedColumns } = params;
    const columns = selectedColumns.length > 0 ? selectedColumns.join(', ') : '1 as dummy';
    const simplify = calculateSimplifyTolerance(zxy.z);

    console.log(`z: ${zxy.z}, simplify level: ${simplify}`);

    return `
        WITH filtered AS (
            -- 空間フィルタリングを先に実行
            SELECT 
                geom,
                ${columns}
            FROM ${selectedTable}
            WHERE ST_Intersects(
                geom,
                -- bbox,
                ST_MakeEnvelope(?, ?, ?, ?)
            )
        )
        SELECT 
            ST_AsGeoJSON(
                ST_Simplify(geom, ${simplify})
            ) AS geojson,
            ${columns}
        FROM filtered
    `;
};

const MapComponent: React.FC<MapProps> = ({ db, selectedTable, selectedColumns }) => {
    const [mapError, setMapError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedZoom, setSelectedZoom] = useState<number>(5); // デフォルトズームレベル
    const mapRef = useRef<maplibregl.Map | null>(null);
    const connectionRef = useRef<DuckDBConnection | null>(null);
    const tileCache = useRef<Map<string, Uint8Array>>(new Map());

    // ズームレベル変更ハンドラー
    const handleZoomChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newZoom = parseInt(event.target.value, 10);
        setSelectedZoom(newZoom);
    };

    useEffect(() => {
        const startTime = new Date();
        console.log(`計測 0 ${startTime.toISOString()} start マップ初期化`);
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

                    const zxy = getZxyFromUrl(params.url);
                    if (!zxy) throw new Error('invalid tile url: ' + params.url);
                    const cacheKey = `${zxy.z}/${zxy.x}/${zxy.y}`;

                    const addProtocolTime = new Date();
                    console.log(`計測 ${cacheKey} 1 ${addProtocolTime.toISOString()} start addProtocol`);

                    // キャッシュをチェック
                    // console.log('Cache get key:', cacheKey);
                    if (tileCache.current.has(cacheKey)) {
                        console.log(`計測 ${cacheKey} 2 using cached tile`);
                        return { data: tileCache.current.get(cacheKey) };
                    }

                    console.log(`Processing tile: z: ${zxy.z}, x: ${zxy.x}, y: ${zxy.y}`);

                    try {
                        if (!connectionRef.current) {
                            throw new Error('Database connection is not available');
                        }

                        const { minLng, minLat, maxLng, maxLat } = getTileEnvelope(zxy.z, zxy.x, zxy.y);

                        console.log(`Tile bounds: minLng=${minLng}, maxLng=${maxLng}, minLat=${minLat}, maxLat=${maxLat}`);

                        if (!selectedTable) {
                            console.log('No table selected');
                            return { data: new Uint8Array() };
                        }

                        // 選択されたカラムを取得するSQLクエリを構築
                        const query = generateVectorTileQuery({
                            zxy,
                            selectedTable,
                            selectedColumns,
                        });
                        console.log('query: ' + query);
                        const queryStartTime = new Date();
                        console.log('Executing query:', query);
                        console.log(`計測 ${cacheKey} 2 ${queryStartTime.toISOString()} start duckdb query`);
                        // const conn = await db.connect();
                        const stmt = await connectionRef.current.prepare(query);
                        const result = await stmt.query(minLng, minLat, maxLng, maxLat);
                        const queryEndTime = new Date();
                        const queryElapsedMs = queryEndTime.getTime() - queryStartTime.getTime();
                        console.log(`Query returned ${result.numRows} rows`);
                        console.log(`計測 ${cacheKey} 3 ${queryEndTime.toISOString()} end duckdb query, elapsed: ${queryElapsedMs}ms ${result.numRows} rows`);

                        if (result.numRows === 0) {
                            console.log(`計測 ${cacheKey} 3 No data found for this tile`);
                            console.log('cache io set key:', cacheKey);
                            tileCache.current.set(cacheKey, new Uint8Array());
                            return { data: new Uint8Array() };
                        }

                        const rows = result.toArray() as Array<{ geojson: string } & Record<string, string | number | null>>;
                        // console.log('Raw data:', rows);

                        const featureStartTime = new Date();
                        console.log(`計測 ${cacheKey} 4 ${featureStartTime.toISOString()} start feature`);
                        const features = rows
                            .map(row => {
                                try {
                                    if (!row.geojson) {
                                        console.warn('Empty geojson for row:', row);
                                        return null;
                                    }
                                    const geometry = JSON.parse(row.geojson) as Geometry;
                                    // console.log(`Parsed geometry ${index}:`, geometry);

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
                        const featureEndTime = new Date();
                        const featureElapsedMs = featureEndTime.getTime() - featureStartTime.getTime();
                        console.log(`計測 ${cacheKey} 5 ${featureEndTime.toISOString()} end feature, elapsed: ${featureElapsedMs}ms`);

                        // console.log('Processed features:', features);

                        if (features.length === 0) {
                            console.log(`計測 ${cacheKey} 6 No valid features found`);
                            console.log('cache io set key:', cacheKey);
                            tileCache.current.set(cacheKey, new Uint8Array());
                            return { data: new Uint8Array() };
                        }

                        // console.log('Generating vector tile...');
                        const vectorStartTime = new Date();
                        console.log(`計測 ${cacheKey} 6 ${vectorStartTime.toISOString()} start vector`);
                        const vectorTile = geojsonToVectorTile(features, zxy.z, zxy.x, zxy.y);
                        const vectorEndTime = new Date();
                        const vectorElapsedMs = vectorEndTime.getTime() - vectorStartTime.getTime();
                        console.log(`計測 ${cacheKey} 7 ${vectorEndTime.toISOString()} end  vector, elapsed: ${vectorElapsedMs}ms`);
                        console.log('Vector tile generated, size:', vectorTile.length);

                        // 新しいUint8Arrayを作成して、データをコピー
                        const vectorTileCopy = new Uint8Array(vectorTile.length);
                        vectorTileCopy.set(vectorTile);

                        // キャッシュには新しいコピーを保存
                        console.log('cache io set key:', cacheKey);
                        const cacheData = new Uint8Array(vectorTileCopy.length);
                        cacheData.set(vectorTileCopy);
                        tileCache.current.set(cacheKey, cacheData);

                        // 返り値用に別のコピーを作成
                        const returnData = new Uint8Array(vectorTileCopy.length);
                        returnData.set(vectorTileCopy);
                        const endTime = new Date();
                        const totalElapsedMs = endTime.getTime() - addProtocolTime.getTime();
                        console.log(`計測 ${cacheKey} 8 ${endTime.toISOString()} end addProtocol, total elapsed: ${totalElapsedMs}ms`);
                        return { data: returnData };
                    } catch (error) {
                        // console.log('cache io set key:', cacheKey);
                        // tileCache.current.set(cacheKey, new Uint8Array());
                        console.error('Error processing tile:', error);
                        return { data: new Uint8Array() };
                    }
                });

                // マップの初期化
                const mapInstance = new maplibregl.Map({
                    container: 'map',
                    zoom: selectedZoom, // 初期ズームレベルを状態から設定
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

                mapRef.current = mapInstance; // マップインスタンスを保存

                // マップの読み込み完了時の処理
                mapInstance.on('load', () => {
                    const endTime = new Date();
                    const totalElapsedMs = endTime.getTime() - startTime.getTime();
                    console.log(`計測 9 ${endTime.toISOString()} end マップ初期化, total elapsed: ${totalElapsedMs}ms`);
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
    }, [db, selectedTable, selectedColumns, selectedZoom]);

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
            {/* ズームレベル選択 */}
            <div
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1,
                    background: 'white',
                    padding: '5px',
                    borderRadius: '5px',
                    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                }}
            >
                <select
                    value={selectedZoom}
                    onChange={handleZoomChange}
                    style={{
                        padding: '5px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                    }}
                >
                    {Array.from({ length: 31 }, (_, i) => (
                        <option key={i} value={i}>
                            ズームレベル {i}
                        </option>
                    ))}
                </select>
            </div>
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
