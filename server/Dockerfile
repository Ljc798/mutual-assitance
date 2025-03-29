# 使用 Node.js 官方镜像
FROM node:20.18.0

# 安装根证书
RUN apt-get update && apt-get install -y ca-certificates

# 设置工作目录
WORKDIR /app

# 拷贝依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install --omit=dev

# 拷贝所有后端项目代码（在 server/ 目录下）
COPY . .

# ✅ 证书已经包含在上面的 COPY . . 中，其实下面这句可以省略
# COPY cert /app/cert

# 设置生产环境变量
ENV NODE_ENV=production

# 启用端口
EXPOSE 80

# 启动服务
CMD ["node", "index.js"]
