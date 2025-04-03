import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useState } from 'react';

const Map: React.FC<{ db: AsyncDuckDB }> = ({ db }) => {
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('マップ初期化開始');

    // Add geojson protocol handler
    maplibregl.addProtocol('duckdb-geojson', (params, abortController) => {
      console.log('Protocol handler called with URL:', params.url);

      // URLをデコード
      const decodedUrl = decodeURIComponent(params.url);
      console.log('Decoded URL:', decodedUrl);

      // タイルパスの解析を改善
      const match = decodedUrl.match(/duckdb-geojson:\/\/(\d+)\/(\d+)\/(\d+)\.geojson$/);
      if (!match) {
        console.error('Invalid tile path format:', decodedUrl);
        return Promise.reject(new Error('Invalid tile path'));
      }

      const [z, x, y] = match.slice(1).map(Number);
      console.log(`Processing tile: z: ${z}, x: ${x}, y: ${y}`);

      return new Promise((resolve, reject) => {
        // 中断された場合は処理を中止
        if (abortController.signal.aborted) {
          reject(new Error('Aborted'));
          return;
        }

        db.connect()
          .then(conn => {
            if (!conn) {
              console.warn('DuckDB not ready');
              reject(new Error('DB not ready'));
              return;
            }

            const minLng = (x / Math.pow(2, z)) * 360 - 180;
            const maxLng = ((x + 1) / Math.pow(2, z)) * 360 - 180;
            const minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / Math.pow(2, z)))) * (180 / Math.PI);
            const maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / Math.pow(2, z)))) * (180 / Math.PI);

            // WITH zxy_to_lat_lon as (
            //     SELECT
            //         (${x} / POWER(2, ${z}) * 360.0) - 180.0 AS lon,
            //         DEGREES(ATAN(SIN(PI() - 2.0 * PI() * ${y} / POWER(2, ${z})))) AS lat
            // )
            // SELECT ST_AsGeoJSON(
            //     ST_Intersection(
            //         -- ST_Transform(geom, 3857),
            //         geom,
            //         ST_MakeEnvelope(zxy_to_lat_lon.lon, zxy_to_lat_lon.lat, zxy_to_lat_lon.lon + 1, zxy_to_lat_lon.lat + 1)
            //     )
            // ) AS geojson
            // FROM uc14, zxy_to_lat_lon
            // WHERE ST_Intersects(geom, ST_MakeEnvelope(zxy_to_lat_lon.lon, zxy_to_lat_lon.lat, zxy_to_lat_lon.lon + 1, zxy_to_lat_lon.lat + 1))

            const query = `
                            SELECT ST_AsGeoJSON(
                                ST_Intersection(
                                    -- ST_Transform(geom, 3857),
                                    ST_Simplify(geom, 0.0001),
                                    ST_Simplify(ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}), 0.0001)
                                )
                            ) AS geojson
                            FROM tokyo
                            WHERE ST_Intersects(ST_Simplify(geom, 0.0001), ST_Simplify(ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}), 0.0001))
                        `;

            console.log('Executing query:', query);
            return conn
              .query(query)
              .then(result => {
                console.log('Query result rows:', result.numRows);
                console.log('Query result:', result);

                // 結果が空の場合は空のGeoJSONを返す
                if (result.numRows === 0) {
                  console.log('No data found for this tile, returning empty GeoJSON');
                  const emptyGeoJSON = {
                    type: 'FeatureCollection',
                    features: [],
                  };
                  console.log('Empty GeoJSON to be sent:', emptyGeoJSON);
                  const encoder = new TextEncoder();
                  const data = encoder.encode(JSON.stringify(emptyGeoJSON));
                  console.log('Encoded data:', data);
                  resolve({ data });
                  return;
                }

                try {
                  // 結果を配列に変換
                  const rows = result.toArray();
                  console.log('Rows:', rows);

                  // 各行のgeojsonフィールドをパース
                  const features = rows
                    .map((row, index) => {
                      try {
                        console.log(`Parsing row ${index}:`, row);
                        const geometry = JSON.parse(row.geojson);
                        console.log(`Parsed geometry for row ${index}:`, geometry);
                        return {
                          type: 'Feature',
                          geometry: geometry,
                          properties: {
                            id: row.id,
                            name: row.name,
                            type: row.type,
                            description: row.description,
                          },
                        };
                      } catch (parseError) {
                        console.error(`Error parsing row ${index}:`, parseError);
                        console.log('Raw geojson string:', row.geojson);
                        return null;
                      }
                    })
                    .filter(Boolean); // nullを除外

                  console.log('Processed features:', features);

                  // GeoJSONを構築
                  const geojson = {
                    type: 'FeatureCollection',
                    features: features,
                  };

                  console.log('Final GeoJSON:', JSON.stringify(geojson));

                  // GeoJSONを文字列に変換
                  const geojsonString = JSON.stringify(geojson);

                  // 文字列をUint8Arrayに変換
                  const encoder = new TextEncoder();
                  const data = encoder.encode(geojsonString);

                  resolve({ data });
                } catch (error) {
                  console.error('Error processing query result:', error);
                  reject(error);
                }
              })
              .catch(error => {
                console.error('Query error:', error);
                reject(error);
              })
              .finally(() => {
                conn.close();
              });
          })
          .catch(error => {
            console.error('Connection error:', error);
            reject(error);
          });
      });
    });

    try {
      // マップの初期化
      const mapInstance = new maplibregl.Map({
        container: 'map',
        zoom: 10,
        center: [139, 35],
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              maxzoom: 19,
              tileSize: 256,
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            'duckdb-geojson': {
              type: 'geojson',
              data: 'duckdb-geojson://0/0/0.geojson',
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: 'osm-layer',
              source: 'osm',
              type: 'raster',
            },
            {
              id: 'duckdb-layer',
              type: 'fill',
              source: 'duckdb-geojson',
              paint: {
                'fill-color': '#FF6600',
                'fill-opacity': 0.6,
              },
            },
          ],
        },
      });

      // マップの読み込み完了時の処理
      mapInstance.on('load', () => {
        console.log('マップ読み込み完了');
        setIsLoading(false);

        // タイルの更新を処理する関数
        const updateTiles = () => {
          try {
            const zoom = Math.floor(mapInstance.getZoom());
            console.log('Current zoom level:', zoom);

            // 現在のビューポートの中心を取得
            const center = mapInstance.getCenter();
            console.log('Current center:', center);

            // タイル座標を計算
            const x = Math.floor(((center.lng + 180) / 360) * Math.pow(2, zoom));
            const y = Math.floor(
              ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom)
            );
            console.log('Calculated tile coordinates:', {
              x,
              y,
              z: zoom,
            });

            // タイルのURLを更新
            const source = mapInstance.getSource('duckdb-geojson') as maplibregl.GeoJSONSource;
            if (source) {
              const tileUrl = `duckdb-geojson://${zoom}/${x}/${y}.geojson`;
              console.log('Updating tile URL:', tileUrl);
              source.setData(tileUrl);
            } else {
              console.error('Source not found: duckdb-geojson');
            }
          } catch (error) {
            console.error('Error in updateTiles:', error);
            setMapError(`タイル更新エラー: ${error instanceof Error ? error.message : String(error)}`);
          }
        };

        // マップの移動やズームが終わったときにタイルを更新
        mapInstance.on('moveend', updateTiles);
        mapInstance.on('zoomend', updateTiles);

        // 初期タイルを更新
        updateTiles();
      });

      // マップのエラー処理
      mapInstance.on('error', e => {
        console.error('マップエラー:', e);
        setMapError(`マップエラー: ${e.error?.message || '不明なエラー'}`);
      });

      // マップのスタイル読み込み完了時の処理
      mapInstance.on('style.load', () => {
        console.log('マップスタイル読み込み完了');
      });

      // クリーンアップ関数
      return () => {
        if (mapInstance) {
          mapInstance.remove();
        }
      };
    } catch (error) {
      console.error('マップ初期化エラー:', error);
      setMapError(`マップ初期化エラー: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  }, [db]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div
        id="map"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        }}
      ></div>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.8)',
            padding: '10px',
            borderRadius: '5px',
          }}
        >
          マップを読み込み中...
        </div>
      )}
      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(255, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            maxWidth: '80%',
          }}
        >
          エラー: {mapError}
        </div>
      )}
    </div>
  );
};

export default Map;
