# DSH Claude UI 风格滑块（非官方）

**这是一个模仿 Claude UI 和滑块动效的非官方 DeepSeek Harness 插件。**

为 DSH 桌面端及 Web UI 提供模型选择与推理等级滑块，模仿参考视频中 Claude 的深色面板、白色滑块、档位文字过渡与紫色像素火焰。此项目是独立实现，不是 Anthropic / Claude 或 DeepSeek 的官方产品，与这些品牌无隶属关系。

当前版本：**1.0.7**。适配基线：DeepSeek Harness 桌面版 **0.2.1-rc.2**。最新修复已构建，但尚未重新进行自动或桌面交互测试，详见 [验证状态](VALIDATION.md)。

## 功能

- 模型与推理等级使用独立按钮，读取 DSH 当前会话的真实可用模型及档位。
- 拖动时连续预览，松手吸附并保存一次；支持方向键、Home、End、PageUp、PageDown。
- 最高可用档位显示紫色像素火焰：从白色滑块旁向左逐渐蔓延，随后持续明暗变化。
- 从最高档往回拖时，残留像素跟随滑块收回，并逐渐淡出。
- 档位文字以轻微滑动、模糊和淡入淡出切换，增减档时方向相反。
- 点击右上角 `?` 查看插件名称、版本与功能说明。
- 滑轨与拖动过程保持普通鼠标箭头；支持 `prefers-reduced-motion`。

## 安装到 DSH 桌面端

### 本地安装包

1. [下载 dsh-claude-video-slider-1.0.7.tgz](https://github.com/Ledas-as/dsh-claude-video-slider/raw/refs/heads/main/packages/dsh-claude-video-slider-1.0.7.tgz)。
2. 在 DSH 的插件管理中添加这个本地 `.tgz` 文件并启用插件。
3. 正常退出并重新打开 DSH，使客户端载入新组件。点击输入框旁的推理等级打开滑块。

也可以使用 Windows 桌面版自带 CLI；把安装包路径改成实际下载位置：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add 'C:\Plugins\dsh-claude-video-slider-1.0.7.tgz' --ignore-scripts
```

桌面版默认使用 `desktop` profile。安装包已包含构建入口，无需在本地包安装时运行构建脚本。

### GitHub 仓库地址

支持 GitHub 包地址的 DSH 插件管理器也可填写：

```text
github:Ledas-as/dsh-claude-video-slider
```

这种方式需要本机安装 Git 且可以访问 GitHub；地址安装仓库默认分支的内容。

如果启用了其他替换模型选择器的插件，建议在插件管理中只保留一个启用，以免争用同一个 DSH 控件位置。若遇到 `profile reload requires the root Include entry`，正常退出并重新打开 DSH 后再查看。

### Web 版

使用 Web UI 时，在启动 DSH 的环境中安装到对应 profile，例如：

```powershell
dsh plugin --profile web add 'C:\Plugins\dsh-claude-video-slider-1.0.7.tgz' --ignore-scripts
```

然后重新启动该 Web 实例并刷新网页。自定义 profile 请替换示例中的 `web`。

## 独立预览

下载并解压仓库源码，双击 `demo/index.html` 即可体验，无需连接模型服务。点击 `Ultracode ↗` 查看最高档动画，也可以切换三档演示模型。

演示中的 `Opus 5.5`、六档名称及 `Ultracode` 仅用于模仿视频，不代表提供或接入这些模型。正式插件始终使用当前模型实际公开的名称和档位。

## 档位与保存

- 档位来自当前模型的 `reasoning.efforts`；最高可用档位显示紫色动画，不会为模型添加虚构参数。
- `Recommended` 刻度对应模型的 `defaultEffort`；没有默认值时标记第一档。
- `使用模型默认` 提交时省略 `reasoningEffort`，与明确选择某一档不同。
- 通过 DSH 自带的会话模型目录保存，并跟随其订阅更新；设置在后续请求生效。
- 拖动取消或拖动中按 Escape 恢复原值。保存失败时显示错误并恢复已保存档位。
- 当前模型没有推理等级元数据时只提供默认选项；subagent 会话不挂载本选择器。

## 开发

构建脚本仅使用 Node.js 内置模块。运行时复用 DSH 提供的 React，无需新增动画库或图片资源。

```powershell
npm run build
npm run check
npm pack --ignore-scripts
```

- `src/slider.js`：滑块、像素动画及文字过渡组件。
- `src/client.js`：DSH / React 接入层。
- `lib/client.js`：预构建的 ModuleLoader 入口。
- `index.js`、`cordis.patch.yml`：Host 伴随入口与插件注册。
- `demo/index.html`：独立演示。
- `packages/`：可直接下载的安装包。

修改组件后请重新构建，并重新打开 DSH 加载；旧客户端窗口中已经注册的 Web Component 不会自动替换。

## 版本记录

| 版本 | 变化 |
| --- | --- |
| 1.0.7 | 保存中保持滑轨、按钮亮度和像素动画，避免切档时闪烁 |
| 1.0.6 | 离开最高档渐退、残留像素收回、模型与档位文字过渡 |
| 1.0.5 | 紫色像素按位置逐个点燃，向左蔓延约两秒 |
| 1.0.4 | 滑轨悬停与拖动保持普通箭头指针 |
| 1.0.3 | 问号可点击查看插件信息 |
| 1.0.2 | 补齐 DSH 服务声明，修复桌面控件加载 |

## 参考与授权

- UI 与动效模仿：Claude 界面参考录屏。参考录屏未随仓库分发。
- DSH 接入参考：[MEMZ-JZY/DSH-Claude-Style-Reasoning-Slider](https://github.com/MEMZ-JZY/DSH-Claude-Style-Reasoning-Slider)，MIT；保留原作者署名，视觉组件另行实现。
- 宿主：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，运行库由 DSH 提供。

本项目采用 [MIT License](LICENSE)。第三方来源与署名详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
