# Vega LRC

一个使用 Vue 3 + Vite + TypeScript + Tailwind CSS 重新实现的现代歌词在线编辑器。

## 已完成功能（阶段一 ~ 阶段四）

### 编辑器核心
- 上传音频并显示波形
- 自动读取音频元数据（歌名、歌手、专辑、封面图）
- 粘贴歌词文本
- 导入 LRC 文件（支持 UTF-8 / GBK 自动回退）
- 播放 / 暂停
- 打时间戳，自动跳到下一行
- 双击编辑时间、歌词、翻译
- 选中当前行重新打点
- 添加 / 删除歌词行
- 导出 LRC 前预览
- 下载 LRC 文件（文件名跟随歌曲文件名）
- 深色 / 浅色主题切换

### 播放优化
- 数值快进 / 快退，默认 0.5s，可自定义
- 时间戳输入跳转，精确到百分秒
- 波形上方显示 6 段辅助线时间标注（可开关）
- 播放预览与歌词列表并排展示，当前歌词放大高亮

### DeepSeek 翻译 / 双语歌词
- 输入 DeepSeek API Key（保存在浏览器本地）
- 使用 `deepseek-chat` 模型进行整首歌词翻译
- 翻译结果逐行写入“翻译”列，可双击手动修改
- 导出 LRC 时按 `原词 / 翻译` 的同行格式输出

### 歌词卡片
- 3 套预设模板：封面卡片 / 极简渐变 / 歌词海报
- 支持全选 / 取消全选歌词行
- 一键下载 PNG
- 收藏到卡片页（当前会话内有效，关闭浏览器后清空）
- 卡片页支持预览、下载、删除

## 本地运行

```bash
npm install
npm run dev
```

然后浏览器打开 http://localhost:5173

## DeepSeek 翻译说明

本地开发时，Vite 已配置代理：

```
/api/deepseek -> https://api.deepseek.com
```

翻译弹窗里输入自己的 DeepSeek API Key 即可。Key 只保存在浏览器 `localStorage`。

## 构建

```bash
npm run build
npm run preview
```

## 技术栈

- Vue 3 + TypeScript + Vue Router + Pinia
- Vite
- Tailwind CSS v4
- Wavesurfer.js
- music-metadata
- html-to-image

## GitHub Pages 部署

本项目已配置好 GitHub Pages 部署：

1. 推送代码到 GitHub 仓库 `Airlo/vega-lrc`
2. 在仓库 Settings → Pages 中：
   - Source 选择 `GitHub Actions`
3. 每次推送到 `main` 分支会自动构建并部署

部署地址：

```
https://<你的用户名>.github.io/vega-lrc/
```

当前路由使用 Hash 模式，刷新页面不会 404。
