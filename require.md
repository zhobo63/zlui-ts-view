# zlui-ts view

讀取.ui檔案 顯示預覽

## 前端

- www/ index.html main.js style.css
- dark style like vscode
- package.json 包含套件 "@zhobo63/imgui-ts" "@zhobo63/zlui-ts" "@zhobo63/zlui-ts-spine"
- src/ 目錄放置 typescript 
- www/upload 存放上傳檔案
- 圖示使用font-awesome

### Left Panel

- 可以捲動
- 輸入`縮放比例` @scale: range bar 10% ~ 1000%
  - zlmgr.scale.Set(@scale,@scale)
- 檔案列表: 
  - 拖拉檔案 上傳到 upload資料夾 並更新檔案列表
  - 副檔名.ui為zlui dsl 點擊檔案開啟
- `垃圾桶`按鈕 (使用圖示) `檔案列表`標題右側
  - 按下清空上傳檔案
- 樹狀結構顯示 zlui-framework 的物件

### Right Panel

- 在zlui-framework的物件樹狀結構選擇物件時 顯示物件屬性

### Main Area

- canvas element 繪製 zlui
- 開啟 *.ui 並建立 zlui 繪製於canvas上

## 後端

- nodejs server.js
- config.json
  - Port (default 5600 可以設置)
  - MaxUploadSize (default 5MB 可以設置KB,MB)
