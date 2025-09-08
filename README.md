安全的地址区划查询应用
本项目包含一个前端网页和一个后端代理函数，用于安全地调用高德地图API来查询地址的行政区划信息。API Key被安全地存储在后端，不会暴露给前端用户。

核心优势
安全：高德API Key永远不会发送到用户的浏览器，杜绝了被盗用的风险。

易于部署：项目结构为现代化托管平台（如 Vercel）量身定制，可以实现零配置一键部署。

前后端分离：清晰的项目结构，前端代码 (index.html, style.css, script.js) 和后端逻辑 (api/query.js) 完全分离。

如何部署到线上 (推荐 Vercel)
将您的应用发布到互联网上，让任何人都能访问，最简单的方式是使用 Vercel。

准备工作

一个 GitHub 账号: 注册GitHub。

一个 Vercel 账号: 注册Vercel，可以直接使用GitHub账号登录。

部署步骤

第一步：将代码上传到 GitHub

在您的 GitHub 上创建一个新的代码仓库 (repository)，例如命名为 address-finder。

将我提供给您的所有文件 (index.html, style.css, script.js, api/, package.json, README.md) 上传到这个仓库中。

第二步：在 Vercel 中导入项目

登录 Vercel，进入您的 Dashboard。

点击 "Add New..." -> "Project"。

在 "Import Git Repository" 区域，选择您刚刚创建的 GitHub 仓库，点击 "Import"。

Vercel 会自动识别出这是一个标准的前端项目，您无需修改任何构建设置。

第三步：配置安全的环境变量 (最关键的一步！)

在项目导入页面，展开 "Environment Variables" (环境变量) 选项。

添加一个新的环境变量：

Name: GAODE_API_KEY (名称必须完全一致)

Value: 粘贴您的高德 Web 服务 Key

点击 "Add" 保存。

第四步：部署

点击 "Deploy" 按钮。

Vercel 会开始构建和部署您的应用，整个过程通常不到一分钟。

完成后，Vercel会为您提供一个公开的网址 (例如 address-finder-xxxx.vercel.app)，您的地址查询工具就已经成功上线了！

本地开发与测试 (可选)
如果您想在部署前先在自己电脑上运行测试，可以按以下步骤操作：

安装 Node.js: 从 Node.js 官网 下载并安装。

安装 Vercel CLI: 打开终端或命令提示符，运行 npm install -g vercel。

创建环境变量文件: 在项目根目录下，创建一个名为 .env 的文件。

写入Key: 在 .env 文件中，写入以下内容，并替换成您的Key:

GAODE_API_KEY=您的高德Web服务Key

启动开发服务器: 在终端中，进入项目文件夹，然后运行命令 vercel dev。

命令执行成功后，会显示一个本地地址 (通常是 http://localhost:3000)，在浏览器中打开即可像在线上一样进行测试。

