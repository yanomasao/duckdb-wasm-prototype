import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { createTileGeoJSON } from '../utils/tileUtils';

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

        // タイルのGeoJSONを作成
        const tileGeoJSON = createTileGeoJSON(zoom, lat, lng);
        console.log('Tile GeoJSON:', tileGeoJSON);

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
