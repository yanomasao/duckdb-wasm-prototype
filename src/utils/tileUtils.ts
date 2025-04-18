import { Feature, GeoJsonProperties, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import Pbf from 'pbf';

/**
 * Calculate the bounding box coordinates for a given tile (zoom, x, y) in WGS84 (EPSG:4326)
 * Similar to PostGIS ST_TileEnvelope
 * @param zoom Zoom level
 * @param x Tile X coordinate
 * @param y Tile Y coordinate
 * @returns Array of [west, south, east, north] coordinates in WGS84
 */
export function getTileEnvelope(zoom: number, x: number, y: number): [number, number, number, number] {
    const n = Math.pow(2, zoom);
    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;
    const lat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const lat2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    const north = Math.max(lat1, lat2);
    const south = Math.min(lat1, lat2);

    return [west, south, east, north];
}

/**
 * Calculate the tile coordinates for a given point (longitude, latitude) and zoom level in WGS84 (EPSG:4326)
 * @param lng Longitude in WGS84
 * @param lat Latitude in WGS84
 * @param zoom Zoom level
 * @returns Array of [x, y] tile coordinates
 */
export function getTileCoordinates(lng: number, lat: number, zoom: number): [number, number] {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return [x, y];
}

/**
 * 指定された座標のタイルのGeoJSONを作成
 * @param zoom ズームレベル
 * @param lat 緯度
 * @param lng 経度
 * @returns GeoJSON Feature<Polygon>
 */
export function createTileGeoJSON(z: number, x: number, y: number): {
    type: 'FeatureCollection';
    features: Feature<Polygon>[];
} {
    // タイルの境界を計算
    const minLng = (x / Math.pow(2, z)) * 360 - 180;
    const maxLng = ((x + 1) / Math.pow(2, z)) * 360 - 180;
    const minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / Math.pow(2, z)))) * (180 / Math.PI);
    const maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / Math.pow(2, z)))) * (180 / Math.PI);

    // タイルの境界をGeoJSONのPolygonとして返す
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {
                z,
                x,
                y,
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [minLng, minLat],
                    [maxLng, minLat],
                    [maxLng, maxLat],
                    [minLng, maxLat],
                    [minLng, minLat],
                ]],
            },
        }],
    };
}

// 緯度経度をWebメルカトル座標に変換する関数
function lngLatToMercator(lng: number, lat: number): [number, number] {
    const x = lng * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
}

// Webメルカトル座標を緯度経度に変換する関数
function mercatorToLngLat(x: number, y: number): [number, number] {
    const lng = x * 180 / 20037508.34;
    let lat = y * 180 / 20037508.34;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
    return [lng, lat];
}

export async function geojsonToRaster(features: Feature<Geometry, GeoJsonProperties>[], z: number, x: number, y: number): Promise<Uint8Array> {
    console.log('Converting to Raster:', {
        numFeatures: features.length,
        z, x, y
    });

    // オフスクリーンキャンバスを作成
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Failed to get canvas context');
        return new Uint8Array();
    }

    // 背景を透明に設定
    ctx.clearRect(0, 0, 256, 256);

    // タイルの境界を計算（Webメルカトル座標）
    const tileSize = 20037508.34 * 2 / Math.pow(2, z);
    const minX = -20037508.34 + x * tileSize;
    const maxX = -20037508.34 + (x + 1) * tileSize;
    const minY = 20037508.34 - (y + 1) * tileSize;
    const maxY = 20037508.34 - y * tileSize;

    // 各フィーチャーを描画
    features.forEach(feature => {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const coordinates = feature.geometry.type === 'Polygon'
                ? [feature.geometry.coordinates]
                : feature.geometry.coordinates;

            coordinates.forEach(polygon => {
                polygon.forEach(ring => {
                    // ポリゴンの頂点をピクセル座標に変換
                    const path = new Path2D();
                    ring.forEach((coord, index) => {
                        const position = coord as Position;
                        // 緯度経度をWebメルカトル座標に変換
                        const [mercX, mercY] = lngLatToMercator(position[0], position[1]);
                        // Webメルカトル座標をピクセル座標に変換（Y座標を反転）
                        const xPixel = ((mercX - minX) / (maxX - minX)) * 256;
                        const yPixel = 256 - ((mercY - minY) / (maxY - minY)) * 256;
                        if (index === 0) {
                            path.moveTo(xPixel, yPixel);
                        } else {
                            path.lineTo(xPixel, yPixel);
                        }
                    });
                    path.closePath();

                    // ポリゴンを描画
                    ctx.fillStyle = 'rgba(0, 102, 255, 0.3)';
                    ctx.fill(path);
                    ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.stroke(path);
                });
            });
        } else if (feature.geometry.type === 'Point') {
            // Pointタイプの描画
            const position = feature.geometry.coordinates as Position;
            const [mercX, mercY] = lngLatToMercator(position[0], position[1]);
            const xPixel = Math.floor(((mercX - minX) / (maxX - minX)) * 256);
            const yPixel = Math.floor(256 - ((mercY - minY) / (maxY - minY)) * 256);

            if (xPixel >= 0 && xPixel < 256 && yPixel >= 0 && yPixel < 256) {
                ctx.beginPath();
                ctx.arc(xPixel, yPixel, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        } else if (feature.geometry.type === 'LineString') {
            // LineStringタイプの描画
            const coordinates = feature.geometry.coordinates;
            ctx.beginPath();
            let isFirstPoint = true;
            let lastValidPoint: [number, number] | null = null;

            for (const coord of coordinates) {
                const [mercX, mercY] = lngLatToMercator(coord[0], coord[1]);
                const xPixel = Math.floor(((mercX - minX) / (maxX - minX)) * 256);
                const yPixel = Math.floor(256 - ((mercY - minY) / (maxY - minY)) * 256);

                // 座標がキャンバスの範囲内かチェック
                const isInBounds = xPixel >= 0 && xPixel < 256 && yPixel >= 0 && yPixel < 256;

                if (isInBounds) {
                    if (isFirstPoint) {
                        ctx.moveTo(xPixel, yPixel);
                        isFirstPoint = false;
                        lastValidPoint = [xPixel, yPixel];
                    } else {
                        // 前の点と現在の点の間に線を引く
                        if (lastValidPoint) {
                            ctx.moveTo(lastValidPoint[0], lastValidPoint[1]);
                            ctx.lineTo(xPixel, yPixel);
                        }
                        lastValidPoint = [xPixel, yPixel];
                    }
                } else if (lastValidPoint) {
                    // 範囲外の点をスキップし、次の有効な点まで線を引かない
                    lastValidPoint = null;
                }
            }

            ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (feature.geometry.type === 'MultiLineString') {
            // MultiLineStringタイプの描画
            for (const line of feature.geometry.coordinates) {
                ctx.beginPath();
                let isFirstPoint = true;
                let lastValidPoint: [number, number] | null = null;

                for (const coord of line) {
                    const [mercX, mercY] = lngLatToMercator(coord[0], coord[1]);
                    const xPixel = Math.floor(((mercX - minX) / (maxX - minX)) * 256);
                    const yPixel = Math.floor(256 - ((mercY - minY) / (maxY - minY)) * 256);

                    // 座標がキャンバスの範囲内かチェック
                    const isInBounds = xPixel >= 0 && xPixel < 256 && yPixel >= 0 && yPixel < 256;

                    if (isInBounds) {
                        if (isFirstPoint) {
                            ctx.moveTo(xPixel, yPixel);
                            isFirstPoint = false;
                            lastValidPoint = [xPixel, yPixel];
                        } else {
                            // 前の点と現在の点の間に線を引く
                            if (lastValidPoint) {
                                ctx.moveTo(lastValidPoint[0], lastValidPoint[1]);
                                ctx.lineTo(xPixel, yPixel);
                            }
                            lastValidPoint = [xPixel, yPixel];
                        }
                    } else if (lastValidPoint) {
                        // 範囲外の点をスキップし、次の有効な点まで線を引かない
                        lastValidPoint = null;
                    }
                }

                ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    });

    // キャンバスの内容をPNGデータとして取得
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create blob');
                resolve(new Uint8Array());
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;
                resolve(new Uint8Array(arrayBuffer));
            };
            reader.readAsArrayBuffer(blob);
        }, 'image/png');
    });
}

// 点がポリゴン内にあるかどうかを判定する関数
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function geojsonToMVT(features: Feature<Geometry, GeoJsonProperties>[], z: number, x: number, y: number): Uint8Array {
    console.log('Converting to MVT:', {
        numFeatures: features.length,
        z, x, y
    });

    const pbf = new Pbf();

    // レイヤー情報を書き込む
    pbf.writeVarint(2); // version
    pbf.writeString('uc14'); // name
    pbf.writeVarint(4096); // extent

    // フィーチャーを書き込む
    features.forEach((feature, index) => {
        console.log(`Processing feature ${index}:`, {
            type: feature.geometry.type,
            geometry: feature.geometry
        });

        // フィーチャー情報を書き込む
        pbf.writeMessage(2, (pbfFeature: Pbf) => {
            // フィーチャーID
            pbfFeature.writeVarint(1);
            pbfFeature.writeVarint(index + 1);

            // ジオメトリタイプ
            pbfFeature.writeVarint(3);
            pbfFeature.writeVarint(getMVTType(feature.geometry.type));

            // プロパティ
            pbfFeature.writeMessage(4, (pbfProps: Pbf) => {
                Object.entries(feature.properties || {}).forEach(([key, value]) => {
                    pbfProps.writeString(key);
                    pbfProps.writeString(String(value));
                });
            });

            // ジオメトリ
            pbfFeature.writeMessage(5, (pbfGeom: Pbf) => {
                const geometry = feature.geometry.type === 'Polygon'
                    ? convertPolygonToMVT((feature.geometry as Polygon).coordinates, x, y)
                    : feature.geometry.type === 'MultiPolygon'
                        ? convertMultiPolygonToMVT((feature.geometry as MultiPolygon).coordinates, x, y)
                        : [];

                geometry.forEach((coord: number) => {
                    pbfGeom.writeVarint(coord);
                });
            });
        });
    });

    const mvtData = pbf.finish();
    console.log('Generated MVT data length:', mvtData.length);
    return mvtData;
}

function convertPolygonToMVT(coordinates: number[][][], x: number, y: number): number[] {
    const result: number[] = [];
    coordinates.forEach((ring, ringIndex) => {
        if (ringIndex === 0) {
            // 外側のリング
            result.push(1); // MoveTo
            result.push(ring.length - 1); // 頂点数
            ring.forEach((coord, i) => {
                if (i < ring.length - 1) {
                    const xCoord = Math.floor((coord[0] - x) * 4096);
                    const yCoord = Math.floor((coord[1] - y) * 4096);
                    result.push(xCoord, yCoord);
                }
            });
        } else {
            // 内側のリング（穴）
            result.push(2); // LineTo
            result.push(ring.length - 1); // 頂点数
            ring.forEach((coord, i) => {
                if (i < ring.length - 1) {
                    const xCoord = Math.floor((coord[0] - x) * 4096);
                    const yCoord = Math.floor((coord[1] - y) * 4096);
                    result.push(xCoord, yCoord);
                }
            });
        }
    });
    return result;
}

function convertMultiPolygonToMVT(coordinates: number[][][][], x: number, y: number): number[] {
    const result: number[] = [];
    coordinates.forEach(polygon => {
        result.push(...convertPolygonToMVT(polygon, x, y));
    });
    return result;
}

function getMVTType(geojsonType: string): number {
    switch (geojsonType) {
        case 'Point':
            return 1;
        case 'LineString':
            return 2;
        case 'Polygon':
            return 3;
        case 'MultiPoint':
            return 4;
        case 'MultiLineString':
            return 5;
        case 'MultiPolygon':
            return 6;
        default:
            return 0;
    }
}

export interface TileBounds {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
}

export const calcTileLngLat = (z: number, x: number, y: number): TileBounds => {
    const n = Math.pow(2, z);

    // 経度の計算
    let minLng = (x / n) * 360 - 180;
    let maxLng = ((x + 1) / n) * 360 - 180;

    // 緯度の計算
    let minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);
    let maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);

    // 緯度の範囲を制限（-85.0511287798066から85.0511287798066）
    minLat = Math.max(minLat, -85.0511287798066);
    maxLat = Math.min(maxLat, 85.0511287798066);

    // 経度の範囲を-180から180に正規化
    if (minLng < -180) minLng += 360;
    if (maxLng > 180) maxLng -= 360;

    // 緯度の順序を保証
    if (minLat > maxLat) {
        [minLat, maxLat] = [maxLat, minLat];
    }

    return { minLng, maxLng, minLat, maxLat };
}; 