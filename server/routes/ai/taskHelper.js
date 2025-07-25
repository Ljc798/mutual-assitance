const express = require("express");
const axios = require("axios");
const authMiddleware = require("../authMiddleware");

const router = express.Router();

const DIFY_API_KEY = process.env.AI_TASK_HELPER_API_KEY; // 在环境变量里设置
const DIFY_API_URL = "https://ai.mutualcampus.top/v1/chat-messages";

// 🌟 提取任务结构字段
router.post("/extract", authMiddleware, async (req, res) => {
  const { text, conversation_id, tag } = req.body;
  const userId = req.user.id; // 从认证中间件获取用户ID

  if (!text) {
    return res.status(400).json({ error: "text 为必填参数" });
  }

  try {
    const response = await axios.post(
      DIFY_API_URL,
      {
        query: text,
        user: userId, // 每个用户一条对话线
        conversation_id: conversation_id, // 如果为空则为新对话
        inputs: {
          tag: tag || "字段提取" // 添加tag参数，默认为字段提取
        }, // 将tag作为输入参数传递给Dify
        response_mode: "blocking" // 或 "streaming"，这里我们直接取完整响应
      },
      {
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = response.data;

    res.json({
      status: "ok",
      reply: data.answer || "", // AI 的原始回答
      conversation_id: data.conversation_id || "",
      usage: data.usage || {},
      raw: data
    });
  } catch (error) {
    console.error("❌ 调用 Dify 失败:", error.message, error.response?.data || {});
    res.status(500).json({
      error: "调用 AI 服务失败",
      detail: error.response?.data || error.message
    });
  }
});

module.exports = router;