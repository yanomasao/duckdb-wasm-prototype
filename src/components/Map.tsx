import * as duckdb from "@duckdb/duckdb-wasm";
import maplibregl from "maplibre-gl";
import OpacityControl from "maplibre-gl-opacity";
import "maplibre-gl-opacity/dist/maplibre-gl-opacity.css";
import "maplibre-gl/dist/maplibre-gl.css";
import React, { useEffect, useState } from "react";

interface Point {
    geom: string;
    name: string;
    isQueryResult?: boolean;
    color?: string;
    tableName?: string;
}

interface MapProps {
    points?: Point[];
    db: duckdb.AsyncDuckDB | null;
}

interface GeoJSONFeature {
    type: "Feature";
    geometry: {
        type: "Point" | "Polygon" | "LineString";
        coordinates: number[] | number[][] | number[][][];
    };
    properties: {
        name: string;
        isQueryResult: boolean;
        color?: string;
        tableName?: string;
    };
}

const Map: React.FC<MapProps> = ({ points = [], db }) => {
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

            // // Add click event handler for the map
            // mapInstance.on("click", (e) => {
            //     const { lng, lat } = e.lngLat;

            //     // Remove existing popup if any
            //     if (popup) {
            //         popup.remove();
            //     }

            //     // Create new popup with form
            //     const newPopup = new maplibregl.Popup()
            //         .setLngLat([lng, lat])
            //         .setHTML(
            //             `
            //             <div>
            //                 <div style="margin-bottom: 10px;">
            //                     <div>緯度: ${lat.toFixed(6)}</div>
            //                     <div>経度: ${lng.toFixed(6)}</div>
            //                 </div>
            //                 <form id="point-form" style="margin-top: 10px;">
            //                     <input type="text" id="point-name" placeholder="名称を入力" style="width: 90%; padding: 5px; margin-bottom: 5px;">
            //                     <button type="submit" style="width: 100%; padding: 5px; background-color: #4CAF50; color: white; border: none; cursor: pointer;">保存</button>
            //                 </form>
            //             </div>
            //         `
            //         )
            //         .addTo(mapInstance);

            //     // Add form submit handler
            //     const form = document.getElementById("point-form");
            //     if (form) {
            //         form.addEventListener("submit", async (e) => {
            //             e.preventDefault();
            //             const nameInput = document.getElementById(
            //                 "point-name"
            //             ) as HTMLInputElement;
            //             const name = nameInput.value;
            //             if (name && db) {
            //                 try {
            //                     const conn = await db.connect();
            //                     await conn.query("LOAD spatial;");

            //                     // Create a point geometry from the clicked coordinates
            //                     const pointGeom = `ST_POINT(${lng}, ${lat})`;

            //                     // Insert the point into minato_wk table
            //                     await conn.query(`
            //                         INSERT INTO minato_wk (geom, 名称)
            //                         VALUES (${pointGeom}, '${name}')
            //                     `);
            //                     await conn.query("CHECKPOINT");
            //                     await conn.close();
            //                     alert("ポイントを保存しました");
            //                     newPopup.remove();
            //                 } catch (err) {
            //                     console.error("Error saving point:", err);
            //                     alert("ポイントの保存に失敗しました");
            //                 }
            //             }
            //         });
            //     }

            //     setPopup(newPopup);
            // });
        });

        setMap(mapInstance);

        return () => {
            mapInstance.remove();
        };
    }, [db]);

    // Add points to the map when they change
    useEffect(() => {
        if (!map || !points.length) return;

        // Remove existing layers and source
        const layers = [
            "points-layer",
            "lines-layer",
            "polygons-layer",
            "polygons-outline-layer",
        ];
        layers.forEach((layer) => {
            if (map.getLayer(layer)) {
                map.removeLayer(layer);
            }
        });

        if (map.getSource("points-source")) {
            map.removeSource("points-source");
        }

        // Add new points layer
        const features = points
            .map((point) => {
                try {
                    const geometry = JSON.parse(point.geom);
                    console.log("Parsed geometry:", geometry); // デバッグ用
                    return {
                        type: "Feature",
                        geometry,
                        properties: {
                            name: point.name,
                            isQueryResult: point.isQueryResult || false,
                            color: point.color || "#FF0000",
                            tableName: point.tableName,
                        },
                    };
                } catch (err) {
                    console.error("Error parsing GeoJSON:", point.geom, err);
                    return null;
                }
            })
            .filter((feature): feature is GeoJSONFeature => feature !== null);

        console.log("Features to display:", features); // デバッグ用

        // Add source and layers only if there are features
        if (features.length > 0) {
            map.addSource("points-source", {
                type: "geojson",
                data: {
                    type: "FeatureCollection",
                    features,
                },
            });

            // Add points layer
            map.addLayer({
                id: "points-layer",
                type: "circle",
                source: "points-source",
                filter: ["==", ["geometry-type"], "Point"],
                paint: {
                    "circle-radius": 4,
                    "circle-color": ["get", "color"],
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#ffffff",
                },
            });

            // Add lines layer
            map.addLayer({
                id: "lines-layer",
                type: "line",
                source: "points-source",
                filter: ["==", ["geometry-type"], "LineString"],
                paint: {
                    "line-color": ["get", "color"],
                    "line-width": 3,
                    "line-opacity": 0.8,
                },
            });

            // Add polygons layer
            map.addLayer({
                id: "polygons-layer",
                type: "fill",
                source: "points-source",
                filter: ["==", ["geometry-type"], "Polygon"],
                paint: {
                    "fill-color": ["get", "color"],
                    "fill-opacity": 0.2,
                    "fill-outline-color": ["get", "color"],
                },
            });

            // Add polygon outline layer
            map.addLayer({
                id: "polygons-outline-layer",
                type: "line",
                source: "points-source",
                filter: ["==", ["geometry-type"], "Polygon"],
                paint: {
                    "line-color": ["get", "color"],
                    "line-width": 2,
                    "line-opacity": 1,
                },
            });
        }

        // Add click handler for points, lines and polygons
        const clickHandler = (e: any) => {
            if (e.features && e.features[0]) {
                const feature = e.features[0];
                const geometry = feature.geometry;
                const coordinates =
                    geometry.type === "Point"
                        ? (geometry.coordinates as [number, number])
                        : geometry.type === "LineString"
                        ? ((geometry.coordinates as number[][])[0] as [
                              number,
                              number
                          ])
                        : ((geometry.coordinates as number[][][])[0][0] as [
                              number,
                              number
                          ]);
                const name = feature.properties?.name as string;
                const tableName = feature.properties?.tableName;

                // Remove existing popup if any
                if (popup) {
                    popup.remove();
                }

                // Create new popup
                const newPopup = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    className: "custom-popup",
                })
                    .setLngLat(coordinates)
                    .setHTML(
                        `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong>${name}</strong>
                            </div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                ${
                                    tableName
                                        ? `<div style="margin-bottom: 4px;"><strong>テーブル:</strong> ${tableName}</div>`
                                        : ""
                                }
                                <div>緯度: ${coordinates[1].toFixed(6)}</div>
                                <div>経度: ${coordinates[0].toFixed(6)}</div>
                                <div style="margin-top: 4px; word-break: break-all;">
                                    <strong>geom:</strong><br>
                                    ${JSON.stringify(geometry, null, 2)}
                                </div>
                            </div>
                        </div>
                    `
                    )
                    .addTo(map);

                setPopup(newPopup);
            }
        };

        // Remove existing event listeners
        map.off("click", "points-layer", clickHandler);
        map.off("click", "lines-layer", clickHandler);
        map.off("click", "polygons-layer", clickHandler);
        map.off("click", "polygons-outline-layer", clickHandler);

        // Add new event listeners
        map.on("click", "points-layer", clickHandler);
        map.on("click", "lines-layer", clickHandler);
        map.on("click", "polygons-layer", clickHandler);
        map.on("click", "polygons-outline-layer", clickHandler);

        // Remove existing hover event listeners
        map.off("mouseenter", "points-layer");
        map.off("mouseenter", "lines-layer");
        map.off("mouseenter", "polygons-layer");
        map.off("mouseleave", "points-layer");
        map.off("mouseleave", "lines-layer");
        map.off("mouseleave", "polygons-layer");

        // Add new hover event listeners
        map.on("mouseenter", "points-layer", () => {
            map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseenter", "lines-layer", () => {
            map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseenter", "polygons-layer", () => {
            map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "points-layer", () => {
            map.getCanvas().style.cursor = "";
        });
        map.on("mouseleave", "lines-layer", () => {
            map.getCanvas().style.cursor = "";
        });
        map.on("mouseleave", "polygons-layer", () => {
            map.getCanvas().style.cursor = "";
        });
    }, [map, points, popup]);

    return <div id='map' style={{ height: "80vh" }}></div>;
};

export default Map;
