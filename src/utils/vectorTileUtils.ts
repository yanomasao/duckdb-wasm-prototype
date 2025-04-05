import { Feature, Geometry } from 'geojson';
import vtpbf from 'vt-pbf';

export async function geojsonToVectorTile(
    features: Feature<Geometry>[],
    z: number,
    x: number,
    y: number
): Promise<Uint8Array> {
    console.log('Generating vector tile:', { z, x, y, featureCount: features.length });

    const layer = {
        version: 2,
        name: 'features',
        extent: 4096,
        features: features.map((feature, index) => {
            console.log(`Processing feature ${index}:`, feature);

            if (feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;
                console.log(`Point coordinates:`, { lng, lat });

                // タイル座標系への変換
                const n = Math.pow(2, z);
                const tileX = ((lng + 180) / 360) * n;
                const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

                // タイル内の相対座標に変換
                const xRelative = Math.round((tileX - x) * 4096);
                const yRelative = Math.round((tileY - y) * 4096);

                console.log(`Converted coordinates:`, { xRelative, yRelative });

                // タイル範囲外のポイントは除外
                if (xRelative < 0 || xRelative > 4096 || yRelative < 0 || yRelative > 4096) {
                    console.log(`Point ${index} is outside tile bounds`);
                    return null;
                }

                return {
                    id: index,
                    type: 1, // Point
                    properties: feature.properties || {},
                    geometry: [
                        9, // MoveTo command
                        xRelative,
                        yRelative
                    ]
                };
            }
            return null;
        }).filter((feature): feature is NonNullable<typeof feature> => feature !== null)
    };

    console.log('Generated layer:', layer);

    const vectorTile = {
        [layer.name]: layer
    };

    const buffer = vtpbf.fromGeojsonVt(vectorTile);
    console.log('Final buffer size:', buffer.length);
    return buffer;
} 