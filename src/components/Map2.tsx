import { Feature, Polygon } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { getTileCoordinates, getTileEnvelope } from '../utils/tileUtils';

interface Map2Props {
    zoom: number;
    lat: number;
    lng: number;
}

const Map2: React.FC<Map2Props> = ({ zoom, lat, lng }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        // 中心座標からタイル座標を計算
        const [tileX, tileY] = getTileCoordinates(lng, lat, zoom);
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
            center: [lng, lat],
            zoom: zoom,
        });

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, [zoom, lng, lat]);

    return (
        <div
            ref={mapContainer}
            style={{
                width: '90%',
                aspectRatio: '1/1',
                maxWidth: '1800px',
                margin: '0 auto',
            }}
        />
    );
};

export default Map2;
