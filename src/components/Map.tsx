import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import React, { useEffect } from "react";

const Map: React.FC = () => {
    useEffect(() => {
        console.log("マップ初期化開始");
        
        try {
            // マップの初期化
            const mapInstance = new maplibregl.Map({
                container: "map",
                zoom: 10,
                center: [139, 35],
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
                        }
                    },
                    layers: [
                        {
                            id: "osm-layer",
                            source: "osm",
                            type: "raster",
                        }
                    ],
                },
            });

            // マップのスタイル読み込み完了時の処理
            mapInstance.on("style.load", () => {
                console.log("マップスタイル読み込み完了");
            });

            // クリーンアップ関数
            return () => {
                if (mapInstance) {
                    mapInstance.remove();
                }
            };
        } catch (error) {
            console.error("マップ初期化エラー:", error);
        }
    }, []);

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
            <div id='map' style={{ 
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            }}></div>
        </div>
    );
};

export default Map;
