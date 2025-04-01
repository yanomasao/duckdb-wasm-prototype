import * as duckdb from "@duckdb/duckdb-wasm";
import maplibregl from "maplibre-gl";
import "maplibre-gl-opacity/dist/maplibre-gl-opacity.css";
import "maplibre-gl/dist/maplibre-gl.css";
import React, { useEffect, useState } from "react";

interface Point {
    geom: string;
    name: string;
    isQueryResult?: boolean;
    color?: string;
    tableName?: string;
    columnValues?: Record<string, string | number>;
}

interface MapProps {
    points?: Point[];
    db: duckdb.AsyncDuckDB | null;
    selectedColumns?: string[];
    zoom: number;
    lat: number;
    lng: number;
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
        color: string;
        tableName?: string;
        columnValues?: Record<string, any>;
    };
}

const Map: React.FC<MapProps> = ({ points = [], db, selectedColumns, zoom, lat, lng }) => {
    const [popup, setPopup] = useState<maplibregl.Popup | null>(null);
    const [map, setMap] = useState<maplibregl.Map | null>(null);

    useEffect(() => {
        const mapInstance = new maplibregl.Map({
            container: "map",
            zoom: zoom,
            center: [lng, lat],
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
                ],
            },
        });

        mapInstance.on("load", () => {
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
    }, [db, zoom, lat, lng]);

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

                    // Ensure columnValues is properly handled
                    const properties = {
                        name: point.name,
                        isQueryResult: point.isQueryResult || false,
                        color: point.color || "#FF0000",
                        tableName: point.tableName,
                        columnValues: point.columnValues
                            ? { ...point.columnValues }
                            : {},
                    };

                    return {
                        type: "Feature",
                        geometry,
                        properties,
                    } as GeoJSONFeature;
                } catch (err) {
                    console.error("Error parsing GeoJSON:", point.geom, err);
                    return null;
                }
            })
            .filter((feature): feature is GeoJSONFeature => feature !== null);

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
        const clickHandler = (
            e: maplibregl.MapMouseEvent & {
                features?: maplibregl.MapGeoJSONFeature[];
            }
        ) => {
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
                const columnValues = feature.properties?.columnValues || {};

                // Remove existing popup if any
                if (popup) {
                    popup.remove();
                }

                // Create new popup
                const newPopup = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    className: "custom-popup",
                })
                    .setLngLat(coordinates)
                    .setHTML(
                        `
                        <div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                ${Object.entries(
                                    typeof columnValues === "string"
                                        ? JSON.parse(columnValues)
                                        : columnValues
                                )
                                    .map(([key, value]) => {
                                        return `<div style="margin-top: 4px;">${key}: <strong>${value}</strong></div>`;
                                    })
                                    .join("")}
                                <div>緯度: ${coordinates[1].toFixed(6)}</div>
                                <div>経度: ${coordinates[0].toFixed(6)}</div>
                                ${
                                    tableName
                                        ? `<div style="margin-bottom: 4px;">テーブル: <strong>${tableName}</strong></div>`
                                        : ""
                                }
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
