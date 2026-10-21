# 单词打字练习

这是根据用户提供的更新版压缩页面还原的可读源码。保留该版本的界面、练习规则、设置键名和新增功能，使用仓库原有的两个 JSON 词典。

## 运行

在项目目录启动静态服务器：

```bash
python -m http.server 8000
```

打开 <http://localhost:8000>。词典通过 `fetch` 加载，因此请通过 HTTP 访问页面。

## 文件与修改入口

| 文件 / 函数                                      | 内容                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| `index.html`                                     | 页面结构、设置控件、帮助与日历窗口               |
| `styles.css`                                     | 从附件分离出的完整样式，含主题与日历             |
| `index.js`                                       | 已恢复语义命名、控制流程和中文说明的应用代码     |
| `switchDictionary` / `initializeWords`           | 词典加载、进度、重复与乱序规则                   |
| `startPractice` / `checkTyping` / `updateWord`   | 开始练习、按键校验、单词推进                     |
| `audio`                                          | 单词音频缓存与中文释义朗读                       |
| `practiceCalendar`                               | 每日练习记录、汇总和六个月日历                   |
| `showFireworks`                                  | 完成单词后的粒子动画                             |
| `setupEventListeners` / `setupKeyboardShortcuts` | 设置按钮、控件与快捷键                           |
| `basic.json` / `cet4.json`                       | 原仓库词典，分别为 1000 和 2607 词               |
| `docs/RESTORATION.md`                            | 还原依据、兼容范围及原有问题                     |
| `tests/fixtures/updated.min.html`                | 从附件去除 Markdown 包装后的压缩版，用于回归对照 |

本项目仍为原生 HTML/CSS/JavaScript，无需构建即可部署。JavaScript 使用普通脚本；部分原有按钮回调依赖事件中的 `this`。持久化设置的旧键名保持不变。

单词音频依赖有道，中文释义依赖浏览器语音功能。附件已有的 Umami 和 Cloudflare 统计脚本也予以保留。附件引用的 `/favicon-32x32.png` 不在原仓库中。

## 验证

需要 Node.js 20 或更新版本，以及 Python 3（用于上面的本地预览）。

```bash
npm ci
npx playwright install chromium --with-deps
npm run check
npm test
```

浏览器回归测试同时打开附件压缩版和可读版，比较初始渲染、操作结果、设置存储、练习记录及日历。测试固定时间和随机数，并替代音频、语音和外部统计请求；不验证第三方语音服务的可用性。

如已有 Chromium，可通过 `CHROMIUM_EXECUTABLE_PATH` 指定可执行文件路径。
