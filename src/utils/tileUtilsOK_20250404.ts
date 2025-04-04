import { Feature, Polygon } from 'geojson';

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