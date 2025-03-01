import maplibregl from 'maplibre-gl';
import OpacityControl from 'maplibre-gl-opacity';
import 'maplibre-gl-opacity/dist/maplibre-gl-opacity.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect } from 'react';

interface MapProps {
    embassies: { name: string; geom: string }[];
}

const Map: React.FC<MapProps> = ({ embassies }) => {
    useEffect(() => {
        const map = new maplibregl.Map({
            container: 'map', // div要素のid
            zoom: 5, // 初期表示のズーム
            center: [138, 37], // 初期表示の中心
            minZoom: 5, // 最小ズーム
            maxZoom: 18, // 最大ズーム
            maxBounds: [122, 20, 154, 50], // 表示可能な範囲
            style: {
                version: 8,
                sources: {
                    // 背景地図ソース
                    osm: {
                        type: 'raster',
                        tiles: [
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        ],
                        maxzoom: 19,
                        tileSize: 256,
                        attribution:
                            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    },
                    // ハザードマップ
                    hazard_flood: {
                        type: 'raster',
                        tiles: [
                            'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png',
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_hightide: {
                        type: 'raster',
                        tiles: [
                            'https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png',
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_tsunami: {
                        type: 'raster',
                        tiles: [
                            'https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png',
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_doseki: {
                        type: 'raster',
                        tiles: [
                            'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png',
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_kyukeisha: {
                        type: 'raster',
                        tiles: [
                            'https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png',
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_jisuberi: {
                        type: 'raster',
                        tiles: [
                            'https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png',
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                },
                layers: [
                    // 背景地図レイヤー
                    {
                        id: 'osm-layer',
                        source: 'osm',
                        type: 'raster',
                    },
                    // ハザードマップ
                    {
                        id: 'hazard_flood-layer',
                        source: 'hazard_flood',
                        type: 'raster',
                        paint: { 'raster-opacity': 0.7 },
                        layout: { visibility: 'none' },
                    },
                    {
                        id: 'hazard_hightide-layer',
                        source: 'hazard_hightide',
                        type: 'raster',
                        paint: { 'raster-opacity': 0.7 },
                        layout: { visibility: 'none' },
                    },
                    {
                        id: 'hazard_tsunami-layer',
                        source: 'hazard_tsunami',
                        type: 'raster',
                        paint: { 'raster-opacity': 0.7 },
                        layout: { visibility: 'none' },
                    },
                    {
                        id: 'hazard_doseki-layer',
                        source: 'hazard_doseki',
                        type: 'raster',
                        paint: { 'raster-opacity': 0.7 },
                        layout: { visibility: 'none' },
                    },
                    {
                        id: 'hazard_kyukeisha-layer',
                        source: 'hazard_kyukeisha',
                        type: 'raster',
                        paint: { 'raster-opacity': 0.7 },
                        layout: { visibility: 'none' },
                    },
                    {
                        id: 'hazard_jisuberi-layer',
                        source: 'hazard_jisuberi',
                        type: 'raster',
                        paint: { 'raster-opacity': 0.7 },
                        layout: { visibility: 'none' },
                    },
                ],
            },
        });

        map.on('load', () => {
            alert(`Map loaded! ${embassies} embassies loaded`);
            // 背景地図・重ねるタイル地図のコントロール
            const opacity = new OpacityControl({
                baseLayers: {
                    'hazard_flood-layer': '洪水浸水想定区域',
                    'hazard_hightide-layer': '高潮浸水想定区域',
                    'hazard_tsunami-layer': '津波浸水想定区域',
                    'hazard_doseki-layer': '土石流警戒区域',
                    'hazard_kyukeisha-layer': '急傾斜警戒区域',
                    'hazard_jisuberi-layer': '地滑り警戒区域',
                },
            });
            map.addControl(opacity, 'top-left');

            // Add embassy data as a new layer
            const embassyFeatures = embassies.map((embassy) => ({
                type: 'Feature',
                geometry: JSON.parse(embassy.geom),
                properties: {
                    name: embassy.name,
                },
            }));

            map.addSource('embassies', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: embassyFeatures,
                },
            });

            map.addLayer({
                id: 'embassies-layer',
                type: 'symbol',
                source: 'embassies',
                layout: {
                    'icon-image': 'marker-15',
                    'text-field': ['get', 'name'],
                    'text-offset': [0, 1.25],
                    'text-anchor': 'top',
                },
            });
        });

        return () => {
            map.remove();
        };
    }, [embassies]);

    return <div id='map' style={{ height: '80vh' }}></div>;
};

export default Map;
