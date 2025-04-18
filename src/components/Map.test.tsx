import { calcTileLngLat } from './Map';

describe('calcTileLngLat', () => {
    test('should calculate correct bounds for zoom level 0', () => {
        const result = calcTileLngLat(0, 0, 0);
        expect(result).toEqual({
            minLng: -180,
            maxLng: 180,
            minLat: -85.0511287798066,
            maxLat: 85.0511287798066,
        });
    });

    test('should calculate correct bounds for zoom level 1', () => {
        const result = calcTileLngLat(1, 1, 1);
        expect(result).toEqual({
            minLng: 0,
            maxLng: 180,
            minLat: -66.51326044311186,
            maxLat: 0,
        });
    });

    test('should calculate correct bounds for zoom level 2', () => {
        const result = calcTileLngLat(2, 2, 2);
        expect(result).toEqual({
            minLng: 90,
            maxLng: 180,
            minLat: -66.51326044311186,
            maxLat: 0,
        });
    });

    test('should handle negative tile coordinates', () => {
        const result = calcTileLngLat(1, -1, -1);
        expect(result).toEqual({
            minLng: -180,
            maxLng: 0,
            minLat: 0,
            maxLat: 66.51326044311186,
        });
    });

    test('should handle edge cases', () => {
        const result = calcTileLngLat(0, 0, 0);
        // 経度の範囲は常に-180から180
        expect(result.minLng).toBeGreaterThanOrEqual(-180);
        expect(result.maxLng).toBeLessThanOrEqual(180);
        // 緯度の範囲は常に-85.0511287798066から85.0511287798066
        expect(result.minLat).toBeGreaterThanOrEqual(-85.0511287798066);
        expect(result.maxLat).toBeLessThanOrEqual(85.0511287798066);
    });
});
