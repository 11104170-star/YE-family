# 葉氏家族互動族譜

祖籍：福建漳州府海澄縣。純 HTML / CSS / JavaScript / D3.js / JSON，無會員、資料庫、後端或付費服務。所有執行資產均在專案內，訪客不需連接 CDN 或外部字型服務。

## 本地預覽

Windows 可直接雙擊專案內的 **啟動族譜.bat**，自動尋找 Node.js、選擇可用的本機連接埠並開啟瀏覽器。請保留命令視窗，關閉即可停止預覽；BAT 須與完整網站資料夾一起保留。可執行 `啟動族譜.bat --check` 僅檢查啟動條件，不開啟瀏覽器。

安裝 Node.js 22 或更新版本，在此資料夾執行（不必安裝 npm 套件）：

```powershell
node scripts/serve.mjs
```

開啟 <http://127.0.0.1:4173>，按 Ctrl+C 結束伺服器。這是本地靜態檔案預覽工具，不是網站所需的後端。不要直接雙擊 `index.html`，瀏覽器的 file:// 限制會阻擋 JSON 與模組讀取。可設定 `$env:PORT=4174` 更換連接埠。若使用 Python，也可執行 `python -m http.server 4173 --bind 127.0.0.1`。

## 使用方式

- 初始顯示葉公名妻支系至第十八世，按卡片下方 `+人數` 展開後代，`−` 收合。
- 選單切換支系；「全部支系」保持兩支各自獨立。
- 輸入姓名、部分姓名或別名（例如「葉阿送」「崑利」「忠雄」），點選結果會自動展開相關祖先、定位並開啟人物面板。可用方向鍵與 Enter；按 `/` 聚焦搜尋，Escape 關閉結果或人物面板。
- 桌面在樹圖空白處拖曳、滾輪縮放；手機單指拖曳、雙指縮放。亦有 `＋`、`−`、全圖視角按鈕。
- 「全部展開」展開目前支系；「回到預設」恢復目前支系至第十八世的預設收合及視角。手機預設以祖先可讀大小呈現，可拖曳瀏覽，不強行縮成整頁。
- 詳細面板中的上代、配偶與子女可點選跳轉。桌面為側面板，手機為底部面板。

## 資料與考證

已完整核對兩頁原始 PDF，共 **74 位具名人物 + 1 筆推測父輩記載**、2 個獨立支系、70 條原文親子關係、2 組夫妻、1 項待考證祖先關係。詳見 [資料檢查報告](docs/data-review.md)。

`data/family.json` 為網站唯一執行時資料來源。每人固定使用 P0001 等 ID，**姓名不能作唯一鍵，同名也不能合併**。欄位包括使用者要求的 id、name、aliases、generation、fatherId、motherId、spouseIds、photo、birthDate、deathDate、biography、notes，並增加：

| 欄位 | 用途 |
| --- | --- |
| parentIds | 原文明確上代，尚未註明父／母角色時使用 |
| branchId | 獨立支系 |
| recordType | person 具名人物；ancestor-note 推測父輩記載 |
| generationStatus | explicit / unknown / inferred |
| source | 原始頁碼與標籤 |
| reviewNotes | 顯示給讀者的待考證說明 |

`relationships` 將親子、配偶與推測祖先分開記錄，每條保留 `id`、`type`、`fromId`、`toId`、`status`、`source.pages`、`source.evidence`。`source-supported` 僅指 PDF 支持該記載，不代表外部血緣已查證；`pending` 的 `possible-ancestor` 不參與親子排版。`reviewItems` 與 `unparsed` 保留尚待釐清事項。

父母角色未知時，`fatherId`、`motherId` 為 null，介面顯示「上代」。確認父／母角色後，可同時填入對應欄位與 parentIds，並在親子關係註明來源；不要因名字、配偶或「傳女」字樣就補定角色或性別。

新增人物只需編輯 JSON：使用未被使用的新 ID，加入支系，更新 parentIds／spouseIds 與相應關係、證據；夫妻引用須雙向。未知用 null、空字串或空陣列；待考證祖先只能放在 pending 關係，不能填入 parentIds。保留既有人物 ID。不同出生世代的配偶關係需人工確認並擴充模型，不可調整史料迎合排版。

`scripts/build_data.py` 是本次原始 PDF 的人工核對登錄表，保留固定 ID 及來源 SHA-256。重新執行會重建初始資料，**會覆蓋 family.json 後來的修改**；日常維護直接修改 JSON，不需要重跑它。

## 照片

照片經本人／管理者確認後放入 `assets/photos/P0001.jpg` 等以 ID 命名的檔案，對應人物填入 `"photo": "assets/photos/P0001.jpg"`。支援 JPG、PNG、WebP，建議壓縮至約 100–250 KB、寬度約 480–800 px。維持原始比例，不裁切或拉伸臉部。

沒有路徑、缺檔或載入失敗時會移除整個照片區，重新計算卡片高度與連線；不放預設頭像。卡片圖片使用 lazy loading。照片高度與無照片卡不同，但每一世代的起始高度對齊，世代間距以該列最高卡片計算。

## 測試與建置

```powershell
node scripts/validate-data.mjs
node --test tests/*.test.js
node scripts/build.mjs
```

輸出 `dist/`，只有部署必要的 HTML、CSS、JS、JSON、資產和資料報告。建置會驗證輸出絕對路徑後重建本專案的 dist，以免已移除的舊照片仍留在產物。原始 PDF、擷取中間檔、測試程式不會放入 Pages 部署產物。所有執行路徑均為相對路徑，支援 `https://帳號.github.io/儲存庫名稱/`。

## 部署至 GitHub Pages

1. 在自己的 GitHub 建立儲存庫，將此專案推送至 `main` 分支。公開儲存庫可使用免費 GitHub Pages；先完成家族資料公開審閱。
2. 儲存庫 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
3. 專案已附 `.github/workflows/pages.yml`，推送 `main` 或手動執行後會驗證、測試、建置、部署 `dist/`。
4. 在 Actions 確認部署成功後，使用 Pages 顯示的實際網址。本地建置成功不表示網站已上線。

工作流程依 [GitHub Pages 官方說明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 設置。若主要分支不是 main，請修改 workflow 的分支條件。專案儲存庫：[11104170-star/YE-family](https://github.com/11104170-star/YE-family)。實際上線狀態請以 Actions 部署結果為準。

## 隱私

GitHub Pages 是公開網站；純前端沒有真正的私人資料存取控制。介面隱藏欄位無法阻止讀取 JSON、照片網址、Git 提交歷史或公開儲存庫中的原始 PDF。**不要提交電話、住址、證件、未經同意的照片或在世者完整出生日期**。請在公開前從資料檔與 Git 歷史清除不應公開內容，並先取得家族同意。

目前 PDF 不含出生日期或照片，初始資料皆為 null。新增在世或生死未知人物僅填出生年份，驗證器會拒絕完整日期；人物面板也僅顯示年份，但這不是存取權限保護。公開原始 PDF 前應另行審閱；Actions 雖不部署 PDF，公開儲存庫仍可被下載。

## 架構與依賴

```text
index.html                  首頁與頁面結構
css/style.css               桌面與手機樣式
js/main.js                  初始化與控制列
js/familyTree.js            D3 渲染、縮放、定位、收合
js/layout.js                配偶群、親子圖與可變高度排版
js/personDetails.js         人物面板與親屬跳轉
js/search.js                姓名／別名即時搜尋
js/dataValidator.js         資料一致性與關係驗證
data/family.json             人物與證據資料
assets/photos/              經確認的人物照片
assets/vendor/              D3.js 7.9.0 與 ISC 授權
docs/data-review.md          資料檢查報告
tests/family.test.js         資料與排版回歸測試
```

唯一瀏覽器函式庫為 [D3.js](https://d3js.org/getting-started)，已本地保存 7.9.0 與授權檔；無 npm 執行依賴。渲染以 SVG 親屬線與 HTML 人物卡組成，配偶群僅用於定位，子女連線只依實際原文人物邊，不從配偶關係推定共同親子。多位配偶與共享子女維持單一人物卡，排版所選主上代不改寫任何原始親屬邊。
