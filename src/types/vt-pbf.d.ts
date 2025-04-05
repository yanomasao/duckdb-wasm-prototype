declare module 'vt-pbf' {
    interface VectorTileLayer {
        version: number;
        name: string;
        extent: number;
        features: Array<{
            id: number;
            type: number;
            properties: Record<string, unknown>;
            geometry: number[];
        }>;
    }

    interface VectorTile {
        [key: string]: VectorTileLayer;
    }

    export function fromGeojsonVt(vectorTile: VectorTile): Uint8Array;
} 