import { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
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

export function geojsonToMVT(features: Feature<Geometry, GeoJsonProperties>[], z: number, x: number, y: number): Uint8Array {
    // MVTデータを格納するバッファを作成
    const pbf = new Pbf();

    // レイヤー情報を書き込む
    pbf.writeVarint(2); // layer version
    pbf.writeString('uc14'); // layer name

    // フィーチャーを書き込む
    features.forEach((feature) => {
        // フィーチャー情報を書き込む
        pbf.writeMessage(2, (pbfInner: Pbf) => {
            pbfInner.writeVarint(1); // feature id
            pbfInner.writeMessage(2, (pbfProps: Pbf) => {
                // プロパティを書き込む
                Object.entries(feature.properties || {}).forEach(([key, value]) => {
                    pbfProps.writeString(key);
                    pbfProps.writeString(String(value));
                });
            });
            pbfInner.writeVarint(getMVTType(feature.geometry.type)); // geometry type

            // ジオメトリを書き込む
            switch (feature.geometry.type) {
                case 'Polygon':
                    writePolygon(pbfInner, feature.geometry.coordinates, x, y);
                    break;
                case 'MultiPolygon':
                    writeMultiPolygon(pbfInner, feature.geometry.coordinates, x, y);
                    break;
                default:
                    console.warn(`Unsupported geometry type: ${feature.geometry.type}`);
            }
        });
    });

    // MVTデータを返す
    return pbf.finish();
}

function writePolygon(pbf: Pbf, coordinates: number[][][], x: number, y: number) {
    // 外側のリング
    const exterior = coordinates[0];
    pbf.writeMessage(4, (pbfInner: Pbf) => {
        const coords = exterior.flatMap(coord => [
            Math.floor((coord[0] - x) * 4096),
            Math.floor((coord[1] - y) * 4096)
        ]);
        coords.forEach(coord => pbfInner.writeVarint(coord));
    });

    // 内側のリング（穴）
    for (let i = 1; i < coordinates.length; i++) {
        pbf.writeMessage(4, (pbfInner: Pbf) => {
            const coords = coordinates[i].flatMap(coord => [
                Math.floor((coord[0] - x) * 4096),
                Math.floor((coord[1] - y) * 4096)
            ]);
            coords.forEach(coord => pbfInner.writeVarint(coord));
        });
    }
}

function writeMultiPolygon(pbf: Pbf, coordinates: number[][][][], x: number, y: number) {
    coordinates.forEach(polygon => {
        writePolygon(pbf, polygon, x, y);
    });
}

function getMVTType(geojsonType: string): 0 | 1 | 2 | 3 {
    switch (geojsonType) {
        case 'Point':
            return 1;
        case 'LineString':
            return 2;
        case 'Polygon':
            return 3;
        default:
            return 0;
    }
} 