// @ts-nocheck
import { VectorTile } from '@mapbox/vector-tile';
import { Feature, Geometry } from 'geojson';
import Pbf from 'pbf';

interface VectorTileLayer {
    name: string;
    version: number;
    extent: number;
    features: {
        id: number;
        type: number;
        geometry: number[];
        tags: any[];
    }[];
}

export function geojsonToVectorTile(features: Feature<Geometry>[], z: number, x: number, y: number): Uint8Array {
    // ベクタータイルの作成
    const layers = {
        features: {
            name: 'features',
            version: 2,
            extent: 4096,
            features: features.map((feature, index) => {
                // ジオメトリタイプの変換
                let geomType: number;
                switch (feature.geometry.type) {
                    case 'Point':
                        geomType = 1; // POINT
                        break;
                    case 'LineString':
                        geomType = 2; // LINESTRING
                        break;
                    case 'Polygon':
                        geomType = 3; // POLYGON
                        break;
                    default:
                        throw new Error(`Unsupported geometry type: ${feature.geometry.type}`);
                }

                // 座標の変換（Webメルカトルからベクタータイル座標系へ）
                const coordinates = transformCoordinates(feature.geometry, z, x, y);

                return {
                    id: index + 1,
                    type: geomType,
                    geometry: coordinates,
                    tags: Object.entries(feature.properties || {}).flatMap(([key, value]) => [
                        key,
                        value
                    ])
                };
            })
        }
    };

    // ベクタータイルをバイナリデータにエンコード
    const pbf = new Pbf();
    const vectorTile = new VectorTile(pbf);
    vectorTile.layers = layers;
    return pbf.finish();
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