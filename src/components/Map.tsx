import maplibregl from "maplibre-gl";
import OpacityControl from "maplibre-gl-opacity";
import "maplibre-gl-opacity/dist/maplibre-gl-opacity.css";
import "maplibre-gl/dist/maplibre-gl.css";
import React, { useEffect, useState } from "react";

interface Point {
    geom: string;
    name: string;
}

interface MapProps {
    points?: Point[];
}

interface GeoJSONFeature {
    type: "Feature";
    geometry: {
        type: string;
        coordinates: number[];
    };
    properties: {
        name: string;
    };
}

const Map: React.FC<MapProps> = ({ points = [] }) => {
    const [popup, setPopup] = useState<maplibregl.Popup | null>(null);
    const [map, setMap] = useState<maplibregl.Map | null>(null);

    useEffect(() => {
        const mapInstance = new maplibregl.Map({
            container: "map",
            zoom: 5,
            center: [138, 37],
            minZoom: 5,
            maxZoom: 18,
            maxBounds: [122, 20, 154, 50],
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: "raster",
                        tiles: [
                            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                        ],
                        maxzoom: 19,
                        tileSize: 256,
                        attribution:
                            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    },
                    hazard_flood: {
                        type: "raster",
                        tiles: [
                            "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_hightide: {
                        type: "raster",
                        tiles: [
                            "https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png",
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_tsunami: {
                        type: "raster",
                        tiles: [
                            "https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png",
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_doseki: {
                        type: "raster",
                        tiles: [
                            "https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png",
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_kyukeisha: {
                        type: "raster",
                        tiles: [
                            "https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png",
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                    hazard_jisuberi: {
                        type: "raster",
                        tiles: [
                            "https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png",
                        ],
                        minzoom: 2,
                        maxzoom: 17,
                        tileSize: 256,
                        attribution:
                            '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
                    },
                },
                layers: [
                    {
                        id: "osm-layer",
                        source: "osm",
                        type: "raster",
                    },
                    {
                        id: "empty-layer",
                        source: "osm",
                        type: "raster",
                        paint: { "raster-opacity": 0 },
                        layout: { visibility: "visible" },
                    },
                    {
                        id: "hazard_flood-layer",
                        source: "hazard_flood",
                        type: "raster",
                        paint: { "raster-opacity": 0.7 },
                        layout: { visibility: "none" },
                    },
                    {
                        id: "hazard_hightide-layer",
                        source: "hazard_hightide",
                        type: "raster",
                        paint: { "raster-opacity": 0.7 },
                        layout: { visibility: "none" },
                    },
                    {
                        id: "hazard_tsunami-layer",
                        source: "hazard_tsunami",
                        type: "raster",
                        paint: { "raster-opacity": 0.7 },
                        layout: { visibility: "none" },
                    },
                    {
                        id: "hazard_doseki-layer",
                        source: "hazard_doseki",
                        type: "raster",
                        paint: { "raster-opacity": 0.7 },
                        layout: { visibility: "none" },
                    },
                    {
                        id: "hazard_kyukeisha-layer",
                        source: "hazard_kyukeisha",
                        type: "raster",
                        paint: { "raster-opacity": 0.7 },
                        layout: { visibility: "none" },
                    },
                    {
                        id: "hazard_jisuberi-layer",
                        source: "hazard_jisuberi",
                        type: "raster",
                        paint: { "raster-opacity": 0.7 },
                        layout: { visibility: "none" },
                    },
                ],
            },
        });

        mapInstance.on("load", () => {
            const opacity = new OpacityControl({
                baseLayers: {
                    "empty-layer": "なし",
                    "hazard_flood-layer": "洪水浸水想定区域",
                    "hazard_hightide-layer": "高潮浸水想定区域",
                    "hazard_tsunami-layer": "津波浸水想定区域",
                    "hazard_doseki-layer": "土石流警戒区域",
                    "hazard_kyukeisha-layer": "急傾斜警戒区域",
                    "hazard_jisuberi-layer": "地滑り警戒区域",
                },
            });
            mapInstance.addControl(opacity, "top-left");

            // Add click event handler for the map
            mapInstance.on("click", (e) => {
                const { lng, lat } = e.lngLat;

                // Remove existing popup if any
                if (popup) {
                    popup.remove();
                }

                // Create new popup with form
                const newPopup = new maplibregl.Popup()
                    .setLngLat([lng, lat])
                    .setHTML(
                        `
                        <div>
                            <div style="margin-bottom: 10px;">
                                <div>緯度: ${lat.toFixed(6)}</div>
                                <div>経度: ${lng.toFixed(6)}</div>
                            </div>
                            <form id="point-form" style="margin-top: 10px;">
                                <input type="text" id="point-name" placeholder="名称を入力" style="width: 90%; padding: 5px; margin-bottom: 5px;">
                                <button type="submit" style="width: 100%; padding: 5px; background-color: #4CAF50; color: white; border: none; cursor: pointer;">保存</button>
                            </form>
                        </div>
                    `
                    )
                    .addTo(mapInstance);

                // Add form submit handler
                const form = document.getElementById("point-form");
                if (form) {
                    form.addEventListener("submit", (e) => {
                        e.preventDefault();
                        const nameInput = document.getElementById(
                            "point-name"
                        ) as HTMLInputElement;
                        const name = nameInput.value;
                        if (name) {
                            // TODO: ここで名称を保存する処理を追加
                            alert(
                                `保存された名称: ${name}\n緯度: ${lat}\n経度: ${lng}`
                            );
                            newPopup.remove();
                        }
                    });
                }

                setPopup(newPopup);
            });
        });

        setMap(mapInstance);

        return () => {
            mapInstance.remove();
        };
    }, []);

    // Add points to the map when they change
    useEffect(() => {
        if (!map || !points.length) return;

        // Remove existing points layer if it exists
        if (map.getLayer("points-layer")) {
            map.removeLayer("points-layer");
        }
        if (map.getSource("points-source")) {
            map.removeSource("points-source");
        }

        // Add new points layer
        map.addSource("points-source", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: points.map((point) => ({
                    type: "Feature",
                    geometry: JSON.parse(point.geom),
                    properties: {
                        name: point.name,
                    },
                })) as GeoJSONFeature[],
            },
        });

        map.addLayer({
            id: "points-layer",
            type: "circle",
            source: "points-source",
            paint: {
                "circle-radius": 8,
                "circle-color": "#000000",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
            },
        });

        // Add click handler for points
        map.on("click", "points-layer", (e) => {
            if (e.features && e.features[0]) {
                const feature = e.features[0] as GeoJSONFeature;
                const coordinates = feature.geometry.coordinates.slice();
                const name = feature.properties.name;

                // Remove existing popup if any
                if (popup) {
                    popup.remove();
                }

                // Create new popup
                const newPopup = new maplibregl.Popup()
                    .setLngLat(coordinates as [number, number])
                    .setHTML(`<div><strong>${name}</strong></div>`)
                    .addTo(map);

                setPopup(newPopup);
            }
        });

        // Change cursor to pointer when hovering over points
        map.on("mouseenter", "points-layer", () => {
            map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "points-layer", () => {
            map.getCanvas().style.cursor = "";
        });
    }, [map, points, popup]);

    return <div id='map' style={{ height: "80vh" }}></div>;
};

export default Map;
