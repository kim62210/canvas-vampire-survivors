# 🔥 幸存者 (Survivor)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-Game-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

一个受《吸血鬼幸存者》(Vampire Survivors) 启发的开源网页游戏。无需安装，打开即玩！

## 🎮 在线试玩

直接在浏览器中打开 `index.html` 即可开始游戏。

## ✨ 游戏特点

### ⚔️ 8种独特武器

| 武器 | 图标 | 特点 | 类型 |
|------|------|------|------|
| 鞭子 | ⚔️ | 向两侧挥击 | 近战 |
| 魔法杖 | 🔮 | 追踪最近的敌人 | 投射物 |
| 飞刀 | 🗡️ | 快速直线射击 | 投射物 |
| 斧头 | 🪓 | 高抛弧线攻击 | 投射物 |
| 十字架 | ✝️ | 回旋飞镖式攻击 | 投射物 |
| 火球杖 | 🔥 | 爆炸范围伤害 | 投射物 |
| 雷电 | ⚡ | 随机劈向敌人 | 即时 |
| 大蒜 | 🧄 | 持续范围伤害 | 光环 |

### 💪 9种被动技能

- ❤️ **活力** - 最大生命值 +20%
- 💚 **恢复** - 每秒恢复 0.5 HP
- 🛡️ **护甲** - 受到的伤害 -1
- 👟 **速度** - 移动速度 +10%
- 💪 **力量** - 伤害 +10%
- 📏 **范围** - 武器范围 +10%
- ⏱️ **冷却** - 攻击速度 +10%
- 🧲 **磁石** - 拾取范围 +25%
- 📈 **成长** - 经验获取 +10%

### 👹 6种敌人类型

- 🦇 **蝙蝠** - 速度快，血量低
- 🧟 **僵尸** - 血量中等，速度较慢
- 💀 **骷髅** - 平衡型敌人
- 🐺 **狼** - 速度快，伤害高
- 🗿 **石魔** - 血量极高，速度慢
- 👻 **幽灵** - 高伤害，会穿墙

### 🎯 核心玩法

- 📈 **无限升级系统** - 武器可升至8级，被动技能可叠加5次
- ⚡ **自动攻击** - 武器会自动攻击附近的敌人
- 🧲 **磁吸经验** - 靠近经验球自动拾取
- ✨ **粒子特效** - 精美的视觉效果
- 📊 **波次系统** - 随时间增加难度

## 🚀 快速开始

### 方式1：直接打开（最简单）

用浏览器直接打开 `index.html` 文件即可开始游戏。

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

### 方式2：使用 Node.js

```bash
# 安装依赖（可选）
npm install

# 启动服务器
npm start

# 或
node server.js

# 然后在浏览器中访问 http://localhost:8080
```

### 方式3：使用 Python

```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080

# 然后在浏览器中访问 http://localhost:8080
```

### 方式4：使用 VS Code Live Server

安装 Live Server 插件，右键点击 `index.html` 选择 "Open with Live Server"。

## 🎯 操作说明

| 按键 | 功能 |
|------|------|
| `W` `A` `S` `D` | 移动角色 |
| `↑` `↓` `←` `→` | 移动角色（备用） |

**游戏提示：**
- 💀 武器会自动攻击附近的敌人
- 💎 击杀敌人掉落经验宝石
- ⬆️ 升级时从3个选项中选择强化
- ⏱️ 存活尽可能长的时间！

## 📂 项目结构

```
vampire-survivors/
├── index.html          # 游戏主页面
├── game.js             # 游戏核心逻辑 (~1400行)
├── server.js           # 本地服务器（可选）
├── package.json        # 项目配置
├── README.md           # 项目说明
├── LICENSE             # MIT 许可证
└── .gitignore          # Git 忽略文件
```

## 🛠️ 技术栈

- **HTML5 Canvas** - 游戏渲染
- **Vanilla JavaScript (ES6+)** - 游戏逻辑
  - Class 语法
  - Arrow Functions
  - Template Literals
  - Destructuring
- **CSS3** - UI 样式

## 🔧 自定义配置

你可以在 `game.js` 文件开头的 `CONFIG` 对象中修改游戏参数：

```javascript
const CONFIG = {
    CANVAS_WIDTH: 1200,      // 画布宽度
    CANVAS_HEIGHT: 800,      // 画布高度
    PLAYER_SPEED: 4,         // 玩家移动速度
    PLAYER_SIZE: 20,         // 玩家大小
    MAX_ENEMIES: 100,        // 最大敌人数量
    SPAWN_RADIUS: 800,       // 敌人生成距离
    DESPAWN_RADIUS: 1000,    // 敌人消失距离
    INVINCIBILITY_TIME: 500  // 受伤无敌时间(毫秒)
};
```

## 📝 更新日志

### v1.0.0 (2024-02-14)
- ✅ 实现核心游戏机制
- ✅ 添加8种武器系统
- ✅ 添加9种被动技能
- ✅ 添加6种敌人类型
- ✅ 实现升级选择系统
- ✅ 添加粒子效果和视觉特效
- ✅ 添加波次提示系统
- ✅ 优化游戏难度曲线

## 🎓 学习资源

如果你想学习游戏开发，这个项目包含以下技术点：

- 🎮 游戏循环和状态管理
- 🎯 碰撞检测系统
- ✨ 粒子系统实现
- 🎨 Canvas 绘图和动画
- 🏗️ 面向对象编程
- 📊 游戏平衡性设计

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

[MIT License](LICENSE) - 可自由使用、修改和分发

## 🙏 致谢

灵感来源于 [Poncle](https://poncle.co/) 的《吸血鬼幸存者》(Vampire Survivors)

---

**享受游戏！🎮 如果这个项目对你有帮助，请给个 ⭐ Star！**
