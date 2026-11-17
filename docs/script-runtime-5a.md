# 5a 脚本运行实现与验证

基于 ce32ceb 的一键状态示例继续开发。5a 是显式启动的脚本运行模式；原有静态识别、一键示例、手动模拟和预设保持独立。5b 页面减法、5c 自动状态面板与存档、5d state.json、5e 采集包尚未实施。

## 模块边界

| 文件 | 责任 |
| --- | --- |
| src/script-project.js | 从 manifest 找入口，收集源码与物品名称，生成事件动作候选；不执行脚本 |
| src/script-sandbox.js | 读取可信的本地运行组件，创建 opaque-origin iframe + Worker，收发消息、超时和销毁 |
| src/script-loader.js | 用固定版本 Babel 转换 ES 模块，包内路径解析、缓存、循环依赖、动态 import、错误路径 |
| src/script-worker.js | 串行处理启动、事件、表单响应、推进 tick；虚拟 Date 和网页定时器；转发错误与输出 |
| src/script-engine.js | 模拟世界/玩家存储、事件、定时器、表单 Promise 和 HUD/聊天输出；纯 JS，可独立测试 |
| src/script-controls.js | 启停、动作、虚拟时钟、诊断、标准输入表单；保留未提交输入 |
| src/script-output.js | 按包内通道前缀选择 HUD，包括工厂引用模板，不依赖某包的控件名或存储键 |
| src/app.js | 将输出接入现有 JSON UI 解析/集合/画布，将集合点击序号交还脚本，停止时恢复原预览 |

现有 collections/bindings 为聊天工厂提供独立事件上下文；animations/playback 使用各实例出生 tick，避免后一条消息覆盖前一条消息的文本或重启动画。运行时最多展示最近 32 条聊天工厂事件，完整输出记录最多 100 条。工厂布局和销毁仍是现有网页布局器的近似，不模拟引擎的全部事件/集合生命周期。

## 已实现的 API 子集

- world/system 事件 subscribe/unsubscribe；物品使用遵循 before → 未取消时 after。支持玩家加入/出生、维度切换与 scriptEventReceive 的动作触发。
- system.run/runTimeout/runInterval/clearRun、runJob/clearJob、waitTicks。推进上限每次 1200 tick，定时器最多 10000 个；任务在虚拟 tick 调用，回调异常隔离。
- ActionFormData、MessageFormData、ModalFormData 的 show Promise、取消/忙碌、按钮选择、下拉/数字滑条/开关/文字输入。兼容常用旧/新参数签名；装饰元素不占按钮序号。
- 玩家及世界动态属性、标签、计分板目标/分数、36 格背包与基本 ItemStack、经验、默认 health、OP 权限。读写记录和运行快照为 5c 留出接口，目前不自动生成状态编辑面板。
- onScreenDisplay.setTitle/updateSubtitle/setActionBar/clearTitle；sendMessage 及基本 rawtext 文本。
- 有限的 @s/@a 玩家命令：give、tag add/remove、scoreboard objectives add、scoreboard players set/add/remove、title/titleraw。选择器过滤、execute、函数及其他世界命令不执行并记录缺口。
- 空世界查询返回 []，未模拟的 block/component 返回 undefined；未知方法记录 API 名、次数、首次堆栈。不是所有未知属性都有可兼容的类型；错误将显示源位置。

不模拟真实实体、方块、战斗、结构、空间查询、权限变更或完整 Script API。外部依赖只提供 @minecraft/server 和 @minecraft/server-ui；其他模块会明确报错。支持常见普通 JavaScript ES 模块，顶层 await、TypeScript 和其他脚本语言不在本轮支持范围。CommonJS 转换覆盖实测循环依赖与 live import，但不承诺所有 ES 模块 TDZ/初始化次序边界都与游戏完全一致。

## 隔离与生命周期

- 导入文件仅作为数据；必须点击启动才能执行。
- iframe 只有 allow-scripts，没有 allow-same-origin。Worker 继承 opaque origin 及 connect-src 'none'、仅 inline/eval/blob script-src 的 CSP，不把导入路径变成网络 URL。
- 父页只接收当前 iframe 的消息，文本使用 textContent；包代码不能访问编辑器 DOM、同源存储或宿主文件。编译器不是对不可信代码的静态安全检查；隔离依赖浏览器机制。
- 单个请求 15 秒无响应会销毁运行环境；首次 frame 启动有 30 秒限时。停止和重新导入会使异步启动失效，旧 Worker 不再回传。没有对恶意内存耗尽提供独立进程配额。
- 入口加载失败不开放动作；回调失败保留诊断并允许继续其他动作。重置重新加载整个模块图，清掉订阅、定时器和挂起表单。
- 停止恢复启动前的导航、操作模式、模拟数据、未应用 JSON 草稿、动画和双屏开关；运行过程不改资源字节或已保存预设。

## 回归范围

- 单元测试：模块 live import/重导出/循环/动态 import、路径限制、表单回传与取消/过期/忙碌、字段类型、非按钮序号、tick 顺序、异常回调隔离、存储与背包、输出、未知 API 汇总、事件前后次序、独立聊天实例与动画年龄、通用 HUD 路由。
- 浏览器独立包：不含 .easysee 配置，导入不执行；动作 → Action → Modal → Message → 领取；暂停/播放/快进，HUD 刷新保留未提交字段，错误定位，网络与 IndexedDB 拒绝，停止恢复，死循环超时回收。
- 武破方穹实际脚本：157 模块；羊皮卷三步引导；34 项真实按钮；秘境和开阳分页；测试事件达成「初识」后，等待虚拟缓存过期并点击领取 R → D；包内管理员菜单设置境界。
- 2257 文件原版回归 ZIP 包含真实 UI 定义及预览贴图，部分无关资源是占位文件。它用于继承、规模与交互回归，不证明原版贴图视觉完全一致。

浏览器回归命令：

```sh
npm start
# 另开 Chromium，使用 --remote-debugging-port=9222
npm run test:scripts -- /path/reference.mcaddon /path/server_form.json /path/vanilla.zip
```
