// @ts-nocheck
import { Feature, Geometry } from 'geojson';
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
    features: Feature<Geometry>[],
    z: number,
    x: number,
    y: number
): Uint8Array {
    // レイヤーの初期化
    const layer = {
        version: 2,
        name: 'features',
        extent: 4096,
        features: []
    };

    features.forEach((feature, index) => {
        const geometry = feature.geometry;
        const properties = feature.properties || {};

        if (geometry.type === 'Point') {
            const coordinates = geometry.coordinates;
            const [lng, lat] = coordinates;

            // タイル座標系への変換
            const n = Math.pow(2, z);
            const tileX = ((lng + 180) / 360) * n;
            const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

            // タイル内の相対座標に変換
            const xRelative = (tileX - x) * 4096;
            const yRelative = (tileY - y) * 4096;

            const commands = [
                9, // MoveTo command (1) with 1 point
                xRelative,
                yRelative
            ];

            layer.features.push({
                id: index,
                type: 1, // Point
                properties: properties,
                geometry: commands
            });
        } else if (geometry.type === 'LineString') {
            const coordinates = geometry.coordinates;
            const commands = [];
            let first = true;

            coordinates.forEach(([lng, lat]) => {
                const n = Math.pow(2, z);
                const tileX = ((lng + 180) / 360) * n;
                const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

                const xRelative = (tileX - x) * 4096;
                const yRelative = (tileY - y) * 4096;

                if (first) {
                    commands.push(9, xRelative, yRelative); // MoveTo
                    first = false;
                } else {
                    commands.push(8, xRelative, yRelative); // LineTo
                }
            });

            layer.features.push({
                id: index,
                type: 2, // LineString
                properties: properties,
                geometry: commands
            });
        } else if (geometry.type === 'Polygon') {
            const coordinates = geometry.coordinates[0]; // 外側のリングのみを処理
            const commands = [];
            let first = true;

            coordinates.forEach(([lng, lat]) => {
                const n = Math.pow(2, z);
                const tileX = ((lng + 180) / 360) * n;
                const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

                const xRelative = (tileX - x) * 4096;
                const yRelative = (tileY - y) * 4096;

                if (first) {
                    commands.push(9, xRelative, yRelative); // MoveTo
                    first = false;
                } else {
                    commands.push(8, xRelative, yRelative); // LineTo
                }
            });

            // ポリゴンを閉じる
            commands.push(7); // ClosePath

            layer.features.push({
                id: index,
                type: 3, // Polygon
                properties: properties,
                geometry: commands
            });
        }
    });

    // ベクタータイルを生成
    const vectorTile = {
        [layer.name]: layer
    };

    return vtpbf.fromGeojsonVt(vectorTile);
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