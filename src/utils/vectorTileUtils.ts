import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

interface VectorTileFeature {
    type: number;
    geometry: number[][];
    properties: Record<string, unknown>;
}

function transformCoordinates(geometry: Geometry, z: number, x: number, y: number): number[] {
    const tileSize = 4096; // ベクタータイルの解像度
    const tileX = x * tileSize;
    const tileY = y * tileSize;
    const scale = tileSize / 256; // タイルサイズのスケール

    const transform = (coord: number[]): number[] => {
        // Webメルカトル座標をタイル座標に変換
        const px = (coord[0] + 180) / 360 * tileSize * Math.pow(2, z);
        const py = (1 - Math.log(Math.tan(coord[1] * Math.PI / 180) + 1 / Math.cos(coord[1] * Math.PI / 180)) / Math.PI) / 2 * tileSize * Math.pow(2, z);

        // タイル座標をベクタータイル座標に変換
        return [
            Math.round((px - tileX) * scale),
            Math.round((py - tileY) * scale)
        ];
    };

    switch (geometry.type) {
        case 'Point':
            return transform(geometry.coordinates);
        case 'LineString':
            return geometry.coordinates.flatMap(coord => transform(coord));
        case 'Polygon':
            return geometry.coordinates[0].flatMap(coord => transform(coord));
        default:
            throw new Error(`Unsupported geometry type: ${geometry.type}`);
    }
}

export function geojsonToVectorTile(
    features: Feature<Geometry, GeoJsonProperties>[],
    z: number,
    x: number,
    y: number
): Uint8Array {
    // geojson-vtでGeoJSONをベクトルタイルに変換
    const tileIndex = geojsonvt({
        type: 'FeatureCollection',
        features: features
    }, {
        generateId: true,
        indexMaxZoom: z,
        maxZoom: z,
        buffer: 0,
        tolerance: 0,
        extent: 4096
    });

    // 指定されたタイルを取得
    const tile = tileIndex.getTile(z, x, y);
    if (!tile) {
        console.log('No tile found for coordinates:', { z, x, y });
        return new Uint8Array();
    }

    // vt-pbfでベクトルタイルをバイナリに変換
    // source-layer名を"v"として設定
    return vtpbf.fromGeojsonVt({ "v": tile });
}

function writeFeature(pbf: Pbf, feature: any) {
    if (feature.id !== undefined) pbf.writeVarintField(1, feature.id);

    const properties = feature.properties || {};
    const keys = Object.keys(properties);
    const values = Object.values(properties);

    const tagged = [];
    keys.forEach((key, i) => {
        tagged.push(i); // key index
        tagged.push(i); // value index
    });

    if (tagged.length) pbf.writePackedVarint(2, tagged);

    if (feature.type !== undefined) pbf.writeVarintField(3, feature.type);
    if (feature.geometry) pbf.writePackedVarint(4, feature.geometry);

    keys.forEach(key => pbf.writeStringField(3, key));
    values.forEach(value => {
        if (typeof value === 'string') pbf.writeStringField(4, value);
        else if (typeof value === 'boolean') pbf.writeBooleanField(7, value);
        else if (typeof value === 'number') pbf.writeDoubleField(5, value);
    });
} 