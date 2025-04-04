import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useState } from 'react';
import { createTileGeoJSON } from '../utils/tileUtils';

interface GeoJSONGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: {
    id: number;
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const Map: React.FC<{ db: AsyncDuckDB }> = ({ db }) => {
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('マップ初期化開始');

    // DuckDBの初期化状態を確認
    if (db) {
      setMapError(null);
    } else {
      console.error('DuckDB is not initialized');
      return;
    }

    // DuckDBの接続を確認
    const initMap = async () => {
      try {
        const conn = await db.connect();
        if (!conn) {
          console.error('Failed to connect to DuckDB');
          setMapError('DuckDBへの接続に失敗しました');
          return;
        }
        conn.close();

        // Add geojson protocol handler
        maplibregl.addProtocol('duckdb-geojson', async (params, abortController) => {
          console.log('Protocol handler called with URL:', params.url);

          // URLをデコード
          const decodedUrl = decodeURIComponent(params.url);
          console.log('Decoded URL:', decodedUrl);

        let [z, x, y] = [0, 0, 0];
          // {z}/{x}/{y}がそのまま文字列として渡された場合は空のデータを返す
          if (decodedUrl === 'duckdb-geojson://{z}/{x}/{y}.geojson') {
            console.log("Template URL detected, returning empty data");
            // const emptyGeoJSON = {
            //   type: 'FeatureCollection',
            //   features: []
            // };
            // return { data: emptyGeoJSON };
          }

          // タイルパスの解析を改善
          const match = decodedUrl.match(/duckdb-geojson:\/\/(\d+)\/(\d+)\/(\d+)\.geojson$/);
          if (!match) {
            console.error('Invalid tile path format:', decodedUrl);
            // return Promise.reject(new Error('Invalid tile path'));
            [z, x, y] = [0, 0, 0];
          }

          if (match)
          [z, x, y] = match.slice(1).map(Number);
          console.log(`Processing tile: z: ${z}, x: ${x}, y: ${y}`);

          // タイルのGeoJSONを作成
          const tileGeoJSON = createTileGeoJSON(z, x, y);
        //   console.log('Tile GeoJSON:', tileGeoJSON);

          return new Promise((resolve, reject) => {
            // 中断された場合は処理を中止
            if (abortController?.signal?.aborted) {
              reject(new Error('Aborted'));
              return;
            }

            // DuckDBの接続を試みる
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
                            --FROM tokyo
                            FROM uc14
                            WHERE ST_Intersects(ST_Simplify(geom, 0.0001), ST_Simplify(ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}), 0.0001))
                        `;

                // console.log('Executing query:', query);
                return conn
                  .query(query)
                  .then(async result => {
                    console.log('Query result rows:', result.numRows);
                    // console.log('Query result:', result);

                    // 結果が空の場合は空のGeoJSONを返す
                    if (result.numRows === 0) {
                      console.log('No data found for this tile, returning empty GeoJSON');
                      resolve({ data: tileGeoJSON });
                      return;
                    }

                    try {
                      // 結果を配列に変換
                      const rows = result.toArray();
                    //   console.log('Rows:', rows);

                      // 各行のgeojsonフィールドをパース
                      const features = rows
                        .map((row, index) => {
                          try {
                            // console.log(`Parsing row ${index}:`, row);
                            const geometry = JSON.parse(row.geojson) as GeoJSONGeometry;
                            // console.log(`Parsed geometry for row ${index}:`, geometry);
                            return {
                              type: 'Feature' as const,
                              geometry: geometry,
                              properties: {
                                id: index,
                              },
                            } as GeoJSONFeature;
                          } catch (parseError) {
                            console.error(`Error parsing row ${index}:`, parseError);
                            // console.log('Raw geojson string:', row.geojson);
                            return null;
                          }
                        })
                        .filter((feature): feature is GeoJSONFeature => feature !== null);

                    //   console.log('Processed features:', features);

                      // GeoJSONを構築
                      const geojson: GeoJSONFeatureCollection = {
                        type: 'FeatureCollection',
                        features: features,
                      };

                    //   console.log('Final GeoJSON:', JSON.stringify(geojson));

                      // タイルのGeoJSONと結合
                      tileGeoJSON.features = [...tileGeoJSON.features, ...geojson.features];
                    //   console.log('Combined GeoJSON:', JSON.stringify(tileGeoJSON));
                      resolve({ data: tileGeoJSON });
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
                  type: 'vector',
                  tiles: ['duckdb-geojson://{z}/{x}/{y}.geojson'],
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
                  "source-layer": 'uc14',
                  paint: {
                    'fill-color': '#FF6600',
                    'fill-opacity': 0.2,
                  },
                },
              ],
            },
          });

          // マップの読み込み完了時の処理
          mapInstance.on('load', () => {
            console.log('マップ読み込み完了');
            setIsLoading(false);

            // // タイルの更新を処理する関数
            // const updateTiles = async () => {
            //   try {
            //     const zoom = Math.floor(mapInstance.getZoom());
            //     console.log('Current zoom level:', zoom);
            //     // 現在のビューポートの中心を取得
            //     const center = mapInstance.getCenter();
            //     console.log('Current center:', center);
            //     // タイル座標を計算
            //     const x = Math.floor(((center.lng + 180) / 360) * Math.pow(2, zoom));
            //     const y = Math.floor(
            //       ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom)
            //     );
            //     console.log('Calculated tile coordinates:', {
            //       x,
            //       y,
            //       z: zoom,
            //     });

            //     // タイルのURLを更新
            //     const source = mapInstance.getSource('duckdb-geojson') as maplibregl.GeoJSONSource;
            //     if (source) {
            //       const tileUrl = `duckdb-geojson://${zoom}/${x}/${y}.geojson`;
            //       console.log('Fetching tile data:', tileUrl);

            //       // プロトコルハンドラーからデータを取得
            //       const response = await new Promise<{ data: ArrayBuffer }>((outerResolve, outerReject) => {
            //         const handler = (params: maplibregl.RequestParameters, abortController: AbortController): Promise<{ data: ArrayBuffer }> => {
            //           return new Promise<{ data: ArrayBuffer }>((resolve, reject) => {
            //             try {
            //               // URLをデコード
            //               const decodedUrl = decodeURIComponent(params.url);
            //               console.log('Decoded URL:', decodedUrl);

            //               // タイルパスの解析を改善
            //               const match = decodedUrl.match(/duckdb-geojson:\/\/(\d+)\/(\d+)\/(\d+)\.geojson$/);
            //               if (!match) {
            //                 console.error('Invalid tile path format:', decodedUrl);
            //                 reject(new Error('Invalid tile path'));
            //                 return;
            //               }

            //               const [z, x, y] = match.slice(1).map(Number);
            //               console.log(`Processing tile: z: ${z}, x: ${x}, y: ${y}`);

            //               // タイルのGeoJSONを作成
            //               const tileGeoJSON = createTileGeoJSON(z, x, y);
            //               console.log('Tile GeoJSON:', tileGeoJSON);

            //               // 中断された場合は処理を中止
            //               if (abortController?.signal?.aborted) {
            //                 reject(new Error('Aborted'));
            //                 return;
            //               }

            //               db.connect()
            //                 .then(conn => {
            //                   if (!conn) {
            //                     console.warn('DuckDB not ready');
            //                     reject(new Error('DB not ready'));
            //                     return;
            //                   }

            //                   const minLng = (x / Math.pow(2, z)) * 360 - 180;
            //                   const maxLng = ((x + 1) / Math.pow(2, z)) * 360 - 180;
            //                   const minLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / Math.pow(2, z)))) * (180 / Math.PI);
            //                   const maxLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / Math.pow(2, z)))) * (180 / Math.PI);

            //                   const query = `
            //                     SELECT ST_AsGeoJSON(
            //                       ST_Intersection(
            //                         ST_Simplify(geom, 0.0001),
            //                         ST_Simplify(ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}), 0.0001)
            //                       )
            //                     ) AS geojson
            //                     FROM tokyo
            //                     -- FROM uc14
            //                     WHERE ST_Intersects(ST_Simplify(geom, 0.0001), ST_Simplify(ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}), 0.0001))
            //                   `;

            //                   console.log('Executing query:', query);
            //                   return conn
            //                     .query(query)
            //                     .then(async result => {
            //                       console.log('Query result rows:', result.numRows);
            //                       console.log('Query result:', result);

            //                       // 結果が空の場合は空のGeoJSONを返す
            //                       if (result.numRows === 0) {
            //                         console.log('No data found for this tile, returning empty GeoJSON');
            //                         const encoder = new TextEncoder();
            //                         const buffer = encoder.encode(JSON.stringify(tileGeoJSON));
            //                         resolve({ data: buffer });
            //                         return;
            //                       }

            //                       try {
            //                         // 結果を配列に変換
            //                         const rows = result.toArray();
            //                         console.log('Rows:', rows);

            //                         // 各行のgeojsonフィールドをパース
            //                         const features = rows
            //                           .map((row, index) => {
            //                             try {
            //                               console.log(`Parsing row ${index}:`, row);
            //                               const geometry = JSON.parse(row.geojson) as GeoJSONGeometry;
            //                               console.log(`Parsed geometry for row ${index}:`, geometry);
            //                               return {
            //                                 type: 'Feature' as const,
            //                                 geometry: geometry,
            //                                 properties: {
            //                                   id: index,
            //                                 },
            //                               } as GeoJSONFeature;
            //                             } catch (parseError) {
            //                               console.error(`Error parsing row ${index}:`, parseError);
            //                               console.log('Raw geojson string:', row.geojson);
            //                               return null;
            //                             }
            //                           })
            //                           .filter((feature): feature is GeoJSONFeature => feature !== null);

            //                         console.log('Processed features:', features);

            //                         // GeoJSONを構築
            //                         const geojson: GeoJSONFeatureCollection = {
            //                           type: 'FeatureCollection',
            //                           features: features,
            //                         };

            //                         console.log('Final GeoJSON:', JSON.stringify(geojson));

            //                         // タイルのGeoJSONと結合
            //                         const combinedGeoJSON = {
            //                           ...tileGeoJSON,
            //                           features: [...tileGeoJSON.features, ...geojson.features] as Feature<Polygon, GeoJsonProperties>[],
            //                         };
            //                         const encoder = new TextEncoder();
            //                         const buffer = encoder.encode(JSON.stringify(combinedGeoJSON));
            //                         resolve({ data: buffer });
            //                       } catch (error) {
            //                         console.error('Error processing query result:', error);
            //                         reject(error);
            //                       }
            //                     })
            //                     .catch(error => {
            //                       console.error('Query error:', error);
            //                       reject(error);
            //                     })
            //                     .finally(() => {
            //                       conn.close();
            //                     });
            //                 })
            //                 .catch(error => {
            //                   console.error('Connection error:', error);
            //                   reject(error);
            //                 });
            //             } catch (error) {
            //               reject(error);
            //             }
            //           });
            //         };

            //         maplibregl.addProtocol('duckdb-geojson', handler);

            //         // プロトコルハンドラーを呼び出す
            //         handler({ url: tileUrl }, new AbortController()).then(outerResolve).catch(outerReject);
            //       });

            //       if (!response || !response.data) {
            //         throw new Error('No data returned from protocol handler');
            //       }

            //       // ArrayBufferをデコード
            //       const decoder = new TextDecoder();
            //       const jsonString = decoder.decode(response.data);
            //       const geojson = JSON.parse(jsonString);

            //       console.log('Setting GeoJSON data:', geojson);
            //       await new Promise<void>((resolve, reject) => {
            //         try {
            //           source.setData(geojson);
            //           resolve();
            //         } catch (error) {
            //           reject(error);
            //         }
            //       });
            //     } else {
            //       console.error('Source not found: duckdb-geojson');
            //     }
            //   } catch (error) {
            //     console.error('Error in updateTiles:', error);
            //     setMapError(`タイル更新エラー: ${error instanceof Error ? error.message : String(error)}`);
            //   }
            // };

            // // マップの移動やズームが終わったときにタイルを更新
            // mapInstance.on('moveend', updateTiles);
            // mapInstance.on('zoomend', updateTiles);

            // // 初期タイルを更新
            // updateTiles();
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
      } catch (error) {
        console.error('Error connecting to DuckDB:', error);
        setMapError(`DuckDB接続エラー: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    };

    initMap();
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
