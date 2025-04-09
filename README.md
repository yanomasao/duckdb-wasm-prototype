# LINKS Veda BI DuckDB-wasmのPoC
## 起動
`npm install && npm run dev` 

chromeの拡張機能 OPFS Explorer （ https://chromewebstore.google.com/detail/opfs-explorer/acndjpgkpaclldomagafnognkcgjignd ）を入れておくと起動時にDuckDBのデータをOPFSに配置していることが確認できます。

## ファイルの登録
- プロジェクトのpublicディレクトリにtmpディレクトリを作成し、geojson, parquetフォーマットのファイルを置きます
- http://localhost:5173/ にアクセスして、「ファイルを選択」をクリックし、上記ファイルを選択します
- 「Create Table from File」ボタンをクリックします
- DuckDB-wasmにテーブルが作成されます
- 「テーブル一覧を表示」ボタンをクリックすると、ファイル名と同じテーブルが作成されていることが確認できます

## 地図に登録したデータを表示
- 「テーブル一覧を表示」ボタンをクリック
- テーブル一覧が表示されたら、地図に表示したいテーブルをクリック
- 地図に表示されないときは、地図をちょっと動かしてみてください
- テーブル一覧の「カラム」ボタンをクリックし、各カラムの「表示」チェックボックスをチェックすると、地図上の当該データの位置をクリックしたときにそのカラムの情報がポップアップに表示されます
