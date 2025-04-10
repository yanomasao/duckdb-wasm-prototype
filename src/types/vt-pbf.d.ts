declare module 'vt-pbf' {
    // export function fromGeojsonVt(data: any, pbf: any): void;
    export function fromGeojsonVt(data: { [key: string]: any }): Uint8Array;
} 