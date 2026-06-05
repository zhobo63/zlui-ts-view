# zlui-ts view

讀取.ui檔案 顯示預覽

## 前端

- www/ index.html main.js style.css
- dark style like vscode
- package.json 包含套件 "@zhobo63/imgui-ts" "@zhobo63/zlui-ts" "@zhobo63/zlui-ts-spine"
- src/ 目錄放置 typescript 
- src/fgui/fgui.ts 讀取fui檔案類型 FGUI.Load
- www/upload 存放上傳檔案
- 圖示使用font-awesome

### Left Panel

- 可以捲動
- 輸入`縮放比例` @scale: range bar 10% ~ 1000%
  - zlmgr.scale.Set(@scale,@scale)
- `25%`按鈕、`50%`按鈕、`100%`按鈕、`200%`按鈕、`400%`按鈕
  - 按下按鈕直接設定縮放比例
- 檔案列表: 
  - 固定高 可以捲動
  - 拖拉檔案 上傳到 upload資料夾 並更新檔案列表
  - 副檔名.ui為zlui dsl 點擊檔案開啟
  - 副檔名.fui為fgui 點擊檔案開啟
- `垃圾桶`按鈕 (使用圖示) `檔案列表`標題右側
  - 按下清空上傳檔案
- 開啟fgui檔案
  - 開啟後顯示`資源`列表: 列表內容為 FGUIPackage resources 的key
  - 支持 hover, selected high light 
  - 點選資源項目則建立zlui元件 
- 資源項目
  - 勾選`TopComponent` (預設勾選)
    過濾條件 resources.type == EResourceType.Component && (resources[":@"].src) 
- 樹狀結構顯示 zlui-framework 的物件
  - 支持 hover, selected high light
  - 可展開/收合的樹狀結構顯示巢狀物件

### Right Panel

- 在zlui-framework的物件樹狀結構選擇物件時 顯示物件屬性

### Main Area

- canvas element 繪製 zlui
- 開啟 *.ui 並建立 zlui 繪製於canvas上
- 上下捲動條
  - scroll_max: zlUIMgr.h - canvas.height
  - scroll_value 改變時 zlUIMgr.y = -scroll_value
- 左右捲動條
  - scroll_max: zlUIMgr.w - canvas.width
  - scroll_value 改變時 zlUIMgr.x = -scroll_value

## 後端

- nodejs server.js
- config.json
  - Port (default 5600 可以設置)
  - MaxUploadSize (default 5MB 可以設置KB,MB)
