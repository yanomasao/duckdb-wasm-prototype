declare module 'pmtiles' {
    interface PMTilesOptions {
        source: string;
        mode: 'read' | 'write';
    }

    export class PMTiles {
        constructor(options: PMTilesOptions);
        writeTile(z: number, x: number, y: number, data: Uint8Array): Promise<void>;
        finalize(): Promise<void>;
    }
} 