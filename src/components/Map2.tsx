import { Feature, Polygon } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { getTileCoordinates, getTileEnvelope } from '../utils/tileUtils';

const Map: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        const zoom = 10;
        const centerLng = 138.9;
        const centerLat = 35.0;

        // 中心座標からタイル座標を計算
        const [tileX, tileY] = getTileCoordinates(centerLng, centerLat, zoom);
        console.log('Tile coordinates:', tileX, tileY);

        // タイルの境界ボックスを計算
        const [west, south, east, north] = getTileEnvelope(zoom, tileX, tileY);
        console.log('Tile bounds:', { west, south, east, north });

        // 境界ボックスからGeoJSONを作成
        const tileGeoJSON: Feature<Polygon> = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [west, south],  // 左下
                    [east, south],  // 右下
                    [east, north],  // 右上
                    [west, north],  // 左上
                    [west, south]   // 左下（閉じる）
                ]]
            }
        };

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    },
                    "static-tile": {
                        type: "geojson",
                        data: tileGeoJSON
                    }
                },
                layers: [
                    {
                        id: 'osm-tiles',
                        type: 'raster',
                        source: 'osm',
                        minzoom: 0,
                        maxzoom: 22
                    },
                    {
                        id: "tile-layer",
                        type: "fill",
                        source: "static-tile",
                        paint: {
                            "fill-color": "#00aaff",
                            "fill-opacity": 0.5
                        }
                    }
                ],
            },
            center: [centerLng, centerLat],
            zoom: zoom,
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    return (
        <div
            ref={mapContainer}
            style={{
                width: '100%',
                height: '100vh',
                // position: 'fixed',
                // top: 0,
                // left: 0,
                // right: 0,
                // bottom: 0,
            }}
        />
    );
};

export default Map;
