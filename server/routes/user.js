const express = require("express");
const router = express.Router();
const db = require("../config/db");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET;
const {
    v4: uuidv4
} = require("uuid");
require("dotenv").config();

// 引入 authMiddleware
const authMiddleware = require("./authMiddleware");

// 🧩 手机号登录 API（使用微信云托管的容器内调用）
router.post("/phone-login", async (req, res) => {
    const {
        code
    } = req.body;
    if (!code) {
        return res.status(400).json({
            success: false,
            message: "缺少 code"
        });
    }

    try {
        // ✅ 使用容器内云调用，不需要 access_token，使用 http
        const wxRes = await axios.post(
            "http://api.weixin.qq.com/wxa/business/getuserphonenumber", {
                code
            }, {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        if (!wxRes.data || !wxRes.data.phone_info) {
            return res.status(400).json({
                success: false,
                message: "获取手机号失败",
                error: wxRes.data
            });
        }

        const phoneNumber = wxRes.data.phone_info.phoneNumber;
        const [results] = await db.query(
            "SELECT * FROM users WHERE phone_number = ?",
            [phoneNumber]
        );

        let user;
        let isNewUser = false;
        if (results.length > 0) {
            user = results[0];
        } else {
            const now = new Date();
            now.setHours(now.getHours() + 8); // 手动加 8 小时
            const newUser = {
                wxid: uuidv4(),
                phone_number: phoneNumber,
                username: "微信用户" + phoneNumber.slice(-4),
                avatar_url: "https://default-avatar.com/avatar.png",
                free_counts: 5,
                points: 10,
                created_time: now
            };
            const [insertResult] = await db.query("INSERT INTO users SET ?", [newUser]);
            newUser.id = insertResult.insertId;
            user = newUser;
            isNewUser = true; // ✅ 标记为新用户
        }

        // 登录成功后，签发 token：
        const token = jwt.sign({
            user_id: user.id
        }, SECRET_KEY, {
            expiresIn: "7d"
        });
        return res.json({
            success: true,
            token,
            user,
            isNewUser // ✅ 返回给前端
        });

    } catch (error) {
        console.error("❌ 获取手机号失败:", error);
        return res.status(500).json({
            success: false,
            message: "服务器错误",
            error: error?.message || "未知错误"
        });
    }
});

// 📌 修改用户信息（使用 authMiddleware 来验证 token）
router.post("/update", authMiddleware, async (req, res) => {
    const userId = req.user.user_id;
    const { username, avatar_url, wxid } = req.body;

    try {
        const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "用户不存在"
            });
        }

        // ✅ 检查 username 是否被其他用户占用
        const [nameCheck] = await db.query(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            [username, userId]
        );
        if (nameCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: "用户名已被占用，请重新输入"
            });
        }

        // ✅ 检查 wxid 是否被其他用户占用
        const [wxidCheck] = await db.query(
            "SELECT id FROM users WHERE wxid = ? AND id != ?",
            [wxid, userId]
        );
        if (wxidCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: "用户ID已被使用，请重新输入"
            });
        }

        // ✅ 执行更新操作
        await db.query(
            "UPDATE users SET username = ?, avatar_url = ?, wxid = ? WHERE id = ?",
            [username, avatar_url, wxid, userId]
        );

        const [updatedUser] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);

        return res.json({
            success: true,
            message: "用户信息更新成功",
            user: updatedUser[0]
        });

    } catch (err) {
        console.error("❌ 更新用户信息失败:", err);
        return res.status(500).json({
            success: false,
            message: "服务器错误"
        });
    }
});

// 📌 获取用户信息（使用 authMiddleware 来验证 token）
router.get("/info", authMiddleware, async (req, res) => {
    const userId = req.user.user_id; // 从 token 中提取 user_id

    try {
        const [results] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "用户不存在"
            });
        }
        return res.json({
            success: true,
            user: results[0]
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "数据库错误"
        });
    }
});

router.post("/check-username", async (req, res) => {
    const { username, user_id } = req.query;

    if (!username) {
        return res.status(400).json({ success: false, message: "缺少 username 参数" });
    }

    try {
        const [rows] = await db.query(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            [username, user_id || 0] // 如果没传 user_id，默认传个 0
        );

        const isAvailable = rows.length === 0;
        res.json({
            success: true,
            available: isAvailable,
            message: isAvailable ? "用户名可用" : "用户名已被占用"
        });
    } catch (err) {
        console.error("❌ 检查用户名失败:", err);
        res.status(500).json({ success: false, message: "服务器错误" });
    }
});

router.post("/check-wxid", async (req, res) => {
    const { wxid, user_id } = req.query;

    if (!wxid) {
        return res.status(400).json({ success: false, message: "缺少 wxid 参数" });
    }

    try {
        const [rows] = await db.query(
            "SELECT id FROM users WHERE wxid = ? AND id != ?",
            [wxid, user_id || 0]
        );

        const isAvailable = rows.length === 0;
        res.json({
            success: true,
            available: isAvailable,
            message: isAvailable ? "用户ID可用" : "用户ID已被占用"
        });
    } catch (err) {
        console.error("❌ 检查用户ID失败:", err);
        res.status(500).json({ success: false, message: "服务器错误" });
    }
});

module.exports = router;