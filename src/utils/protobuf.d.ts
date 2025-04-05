declare module 'vector-tile' {
    export namespace Tile {
        export enum GeomType {
            UNKNOWN = 0,
            POINT = 1,
            LINESTRING = 2,
            POLYGON = 3
        }

        export interface ILayer {
            name: string;
            features: IFeature[];
            keys: string[];
            values: any[];
            version: number;
            extent: number;
        }

        export interface IFeature {
            id: number;
            tags: number[];
            type: GeomType;
            geometry: number[];
        }

        export interface ITile {
            layers: ILayer[];
        }

        export function create(properties: ITile): ITile;
        export function encode(message: ITile): { finish(): Uint8Array };
    }
} 