---
name: "wechat-miniprogram"
description: "微信小程序开发技能，支持多种技术栈，根据需求文档快速创建和开发小程序。当用户提供需求文档、需要创建小程序或开发小程序功能时调用此技能。"
---

# 微信小程序开发技能

## 技能说明

本技能提供完整的小程序开发能力，支持多种技术栈选择，可根据需求文档快速创建和开发小程序功能。

## 技术栈选择

### 1. 原生微信小程序

**适用场景**: 简单应用、需要深度使用微信API、追求极致性能

**技术组成**:
- WXML + WXSS + JavaScript/TypeScript
- 微信原生组件
- 微信云开发或自建后端

**项目结构**:
```
project/
├── pages/              # 页面
├── components/         # 组件
├── utils/              # 工具函数
├── services/           # 服务层
├── app.js              # 应用入口
├── app.json            # 应用配置
└── app.wxss            # 全局样式
```

### 2. Taro (React/Vue语法)

**适用场景**: 跨平台需求、React/Vue技术栈团队、复杂应用

**技术组成**:
- React/Vue + TypeScript
- Taro组件库
- 支持编译到多端

**项目结构**:
```
project/
├── src/
│   ├── pages/          # 页面
│   ├── components/     # 组件
│   ├── services/       # 服务
│   ├── stores/         # 状态管理
│   ├── utils/          # 工具
│   ├── app.tsx         # 应用入口
│   └── app.config.ts   # 应用配置
├── config/             # 构建配置
└── package.json
```

### 3. uni-app (Vue语法)

**适用场景**: 多端发布、Vue技术栈团队、快速开发

**技术组成**:
- Vue 3 + TypeScript
- uni-ui组件库
- 支持编译到多端

**项目结构**:
```
project/
├── pages/              # 页面
├── components/         # 组件
├── store/              # 状态管理
├── utils/              # 工具
├── static/             # 静态资源
├── App.vue             # 应用入口
├── main.ts             # 入口文件
├── pages.json          # 页面配置
└── manifest.json       # 应用配置
```

### 4. 微信小程序原生 + 云开发

**适用场景**: 快速原型、无需自建服务器、轻量级应用

**技术组成**:
- 原生小程序 + TypeScript
- 云函数 + 云数据库 + 云存储
- 无需服务器运维

**项目结构**:
```
project/
├── cloudfunctions/     # 云函数
├── miniprogram/        # 小程序代码
│   ├── pages/
│   ├── components/
│   ├── utils/
│   ├── app.ts
│   └── app.json
└── project.config.json
```

## 开发流程

### 第一步：需求分析

1. **理解需求文档**
   - 提取功能模块
   - 识别核心业务流程
   - 确定页面结构

2. **技术选型**
   - 根据项目复杂度选择技术栈
   - 考虑团队技术背景
   - 评估跨平台需求

### 第二步：项目初始化

**原生小程序**:
```bash
# 使用微信开发者工具创建项目
# 选择模板：基础模板 / TypeScript模板 / 云开发模板
```

**Taro项目**:
```bash
# 安装Taro CLI
npm install -g @tarojs/cli

# 创建项目
taro init my-app
# 选择框架：React/Vue
# 选择TypeScript
# 选择CSS预处理器
# 选择组件库
```

**uni-app项目**:
```bash
# 使用HBuilderX创建
# 或使用CLI
npx degit dcloudio/uni-preset-vue#vite-ts my-app
```

### 第三步：数据库设计

**云开发数据库**:
```javascript
// 集合设计示例
{
  collection: 'users',
  fields: {
    _id: 'string',
    openid: 'string',
    nickname: 'string',
    avatar: 'string',
    createdAt: 'date'
  }
}
```

**自建后端数据库**:
```sql
-- MySQL示例
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) UNIQUE,
  nickname VARCHAR(64),
  avatar VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 第四步：页面开发

**原生小程序页面**:
```javascript
// pages/index/index.js
Page({
  data: {
    list: []
  },
  onLoad() {
    this.loadData()
  },
  async loadData() {
    // 加载数据
  }
})
```

**Taro页面**:
```tsx
// pages/index/index.tsx
import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'

export default function Index() {
  const [list, setList] = useState([])
  
  useLoad(() => {
    loadData()
  })
  
  return (
    <View>
      {list.map(item => <Text key={item.id}>{item.name}</Text>)}
    </View>
  )
}
```

**uni-app页面**:
```vue
<!-- pages/index/index.vue -->
<template>
  <view>
    <text v-for="item in list" :key="item.id">{{ item.name }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const list = ref([])

onMounted(() => {
  loadData()
})
</script>
```

### 第五步：组件开发

**原生小程序组件**:
```javascript
// components/my-component/my-component.js
Component({
  properties: {
    title: String
  },
  data: {
    count: 0
  },
  methods: {
    onTap() {
      this.setData({ count: this.data.count + 1 })
      this.triggerEvent('change', { count: this.data.count })
    }
  }
})
```

**Taro组件**:
```tsx
// components/MyComponent/index.tsx
import { View, Text } from '@tarojs/components'

interface Props {
  title: string
  onChange?: (count: number) => void
}

export default function MyComponent({ title, onChange }: Props) {
  const [count, setCount] = useState(0)
  
  const handleTap = () => {
    setCount(count + 1)
    onChange?.(count + 1)
  }
  
  return (
    <View onClick={handleTap}>
      <Text>{title}: {count}</Text>
    </View>
  )
}
```

### 第六步：云函数/接口开发

**云函数示例**:
```javascript
// cloudfunctions/getList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { page = 1, pageSize = 10 } = event
    const { OPENID } = cloud.getWXContext()
    
    const { data } = await db.collection('items')
      .where({ userId: OPENID })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .orderBy('createdAt', 'desc')
      .get()
    
    return { code: 0, data }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
```

**自建API示例**:
```javascript
// Node.js + Express
router.get('/api/items', async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query
    const items = await Item.find()
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize))
      .sort({ createdAt: -1 })
    
    res.json({ code: 0, data: items })
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message })
  }
})
```

### 第七步：状态管理

**原生小程序**:
```javascript
// utils/store.js
let globalData = {
  userInfo: null,
  token: ''
}

module.exports = {
  get(key) {
    return globalData[key]
  },
  set(key, value) {
    globalData[key] = value
  }
}
```

**Taro + Redux/MobX**:
```tsx
// stores/user.ts
import { makeAutoObservable } from 'mobx'

class UserStore {
  userInfo = null
  token = ''
  
  constructor() {
    makeAutoObservable(this)
  }
  
  setUserInfo(info) {
    this.userInfo = info
  }
}

export default new UserStore()
```

**uni-app + Pinia**:
```ts
// stores/user.ts
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    userInfo: null,
    token: ''
  }),
  actions: {
    setUserInfo(info) {
      this.userInfo = info
    }
  }
})
```

### 第八步：调试与测试

1. **本地调试**
   - 使用开发者工具模拟器
   - 真机调试
   - 远程调试

2. **性能优化**
   - 使用分包加载
   - 图片懒加载
   - 数据缓存
   - 减少setData调用

3. **错误处理**
   - 全局错误捕获
   - 接口错误处理
   - 用户友好提示

### 第九步：发布上线

1. **代码审查**
   - 代码规范检查
   - 功能测试
   - 性能测试

2. **上传代码**
   ```bash
   # 使用开发者工具上传
   # 或使用CLI
   npm run build
   ```

3. **提交审核**
   - 填写版本信息
   - 上传截图
   - 提交审核

4. **发布版本**
   - 审核通过后发布
   - 灰度发布（可选）
   - 监控线上问题

## 开发规范

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 页面文件 | kebab-case | `user-profile/` |
| 组件文件 | PascalCase | `MyComponent/` |
| 工具函数 | camelCase | `formatDate.ts` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL` |
| 接口/类型 | PascalCase + I/T前缀 | `IUserInfo` |

### 代码规范

1. **TypeScript使用**
   - 启用严格模式
   - 定义接口类型
   - 避免any类型

2. **组件设计**
   - 单一职责
   - 属性类型定义
   - 事件命名规范

3. **样式规范**
   - 使用rpx单位
   - 避免!important
   - BEM命名（可选）

### 接口规范

```javascript
// 统一响应格式
{
  code: 0,        // 0成功，非0失败
  data: {},       // 返回数据
  message: ''     // 提示信息
}

// 错误码定义
{
  0: '成功',
  -1: '系统错误',
  401: '未授权',
  403: '禁止访问',
  404: '资源不存在',
  500: '服务器错误'
}
```

## 最佳实践

### 性能优化

1. **分包加载**
   ```json
   {
     "subpackages": [
       {
         "root": "packageA",
         "pages": ["pages/detail/detail"]
       }
     ]
   }
   ```

2. **图片优化**
   - 使用CDN
   - 压缩图片
   - 懒加载

3. **数据缓存**
   ```javascript
   // 本地缓存
   wx.setStorageSync('key', data)
   wx.getStorageSync('key')
   ```

4. **减少setData**
   - 合并多次setData
   - 使用路径更新
   - 避免频繁更新

### 用户体验

1. **加载状态**
   - 骨架屏
   - 加载动画
   - 进度提示

2. **错误处理**
   - 友好提示
   - 重试机制
   - 降级方案

3. **交互反馈**
   - 操作确认
   - 成功提示
   - 失败提示

### 安全实践

1. **数据验证**
   - 前端验证
   - 后端验证
   - 防止注入

2. **权限控制**
   - 用户授权
   - 接口鉴权
   - 数据权限

3. **敏感信息**
   - 不存储敏感数据
   - 使用加密传输
   - 定期更新密钥

## 常见问题

### 1. 如何选择技术栈？

| 场景 | 推荐技术栈 |
|------|-----------|
| 简单应用、学习入门 | 原生小程序 |
| 复杂应用、团队协作 | Taro + React |
| 多端发布、快速开发 | uni-app + Vue |
| 快速原型、无需服务器 | 云开发 |

### 2. 如何处理跨端兼容？

- 使用条件编译
- 避免平台特有API
- 使用跨端组件库

### 3. 如何优化首屏加载？

- 分包加载
- 预加载
- 骨架屏
- 数据预取

### 4. 如何处理复杂状态？

- 使用状态管理库
- 全局事件总线
- 本地持久化

## 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/)
- [Taro官方文档](https://taro-docs.jd.com/)
- [uni-app官方文档](https://uniapp.dcloud.net.cn/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)