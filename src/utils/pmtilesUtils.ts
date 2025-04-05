import { VectorTile } from '@mapbox/vector-tile';
import { Feature, Geometry } from 'geojson';
import Pbf from 'pbf';
import { PMTiles } from 'pmtiles';

interface VectorTileFeature {
    id: number;
    type: number;
    properties: Record<string, string | number | boolean>;
    geometry: number[];
}

export async function geojsonToPMTiles(
    features: Feature<Geometry>[],
    outputPath: string
): Promise<void> {
    const pmtiles = new PMTiles({
        source: outputPath,
        mode: 'write'
    });

    // ベクトルタイルを生成
    const vectorTile = {
        layers: {
            features: {
                version: 2,
                name: 'features',
                extent: 4096,
                features: features.map((feature, index) => {
                    const geometry = feature.geometry;
                    const properties = feature.properties || {};

                    if (geometry.type === 'Point') {
                        const coordinates = geometry.coordinates;
                        const [lng, lat] = coordinates;

                        // タイル座標系への変換
                        const n = Math.pow(2, 0); // ズームレベル0
                        const tileX = ((lng + 180) / 360) * n;
                        const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

                        // タイル内の相対座標に変換
                        const xRelative = Math.round((tileX - 0) * 4096);
                        const yRelative = Math.round((tileY - 0) * 4096);

                        const commands: number[] = [
                            9, // MoveTo command (1) with 1 point
                            xRelative,
                            yRelative
                        ];

                        return {
                            id: index,
                            type: 1, // Point
                            properties: properties,
                            geometry: commands
                        };
                    } else if (geometry.type === 'LineString') {
                        const coordinates = geometry.coordinates;
                        const commands: number[] = [];
                        let first = true;

                        coordinates.forEach(([lng, lat]) => {
                            const n = Math.pow(2, 0);
                            const tileX = ((lng + 180) / 360) * n;
                            const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

                            const xRelative = Math.round((tileX - 0) * 4096);
                            const yRelative = Math.round((tileY - 0) * 4096);

                            if (first) {
                                commands.push(9, xRelative, yRelative); // MoveTo
                                first = false;
                            } else {
                                commands.push(8, xRelative, yRelative); // LineTo
                            }
                        });

                        return {
                            id: index,
                            type: 2, // LineString
                            properties: properties,
                            geometry: commands
                        };
                    } else if (geometry.type === 'Polygon') {
                        const coordinates = geometry.coordinates[0];
                        const commands: number[] = [];
                        let first = true;

                        coordinates.forEach(([lng, lat]) => {
                            const n = Math.pow(2, 0);
                            const tileX = ((lng + 180) / 360) * n;
                            const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

                            const xRelative = Math.round((tileX - 0) * 4096);
                            const yRelative = Math.round((tileY - 0) * 4096);

                            if (first) {
                                commands.push(9, xRelative, yRelative); // MoveTo
                                first = false;
                            } else {
                                commands.push(8, xRelative, yRelative); // LineTo
                            }
                        });

                        commands.push(7); // ClosePath

                        return {
                            id: index,
                            type: 3, // Polygon
                            properties: properties,
                            geometry: commands
                        };
                    }

                    return null;
                }).filter((feature): feature is VectorTileFeature => feature !== null)
            }
        }
    };

    // ベクトルタイルをPBFに変換
    const pbf = new Pbf();
    // @ts-expect-error - VectorTile.write の型定義が不完全なため
    VectorTile.write(vectorTile, pbf);
    const buffer = pbf.finish();

    // PMTilesに書き込む
    await pmtiles.writeTile(0, 0, 0, buffer);
    await pmtiles.finalize();
} 