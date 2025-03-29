const express = require("express");
const router = express.Router();
const db = require("../config/db");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const APP_ID = process.env.WX_APPID;
const APP_SECRET = process.env.WX_SECRET;

// 📌 手机号登录 API
router.post("/phone-login", async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "缺少 code" });

    try {
        const tokenRes = await axios.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`);
        if (!tokenRes.data.access_token) {
            return res.status(500).json({ success: false, message: "获取 access_token 失败", error: tokenRes.data });
        }
        const access_token = tokenRes.data.access_token;

        const wxRes = await axios.post(
            `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${access_token}`,
            { code },
            { headers: { "Content-Type": "application/json" } }
        );

        if (!wxRes.data || !wxRes.data.phone_info) {
            return res.status(400).json({ success: false, message: "获取手机号失败", error: wxRes.data });
        }

        const phoneNumber = wxRes.data.phone_info.phoneNumber;
        const [results] = await db.query("SELECT * FROM users WHERE phone_number = ?", [phoneNumber]);

        let user;
        if (results.length > 0) {
            user = results[0];
        } else {
            const newUser = {
                wxid: uuidv4(),
                phone_number: phoneNumber,
                username: "微信用户" + phoneNumber.slice(-4),
                avatar_url: "https://default-avatar.com/avatar.png",
                free_counts: 5,
                points: 10,
                created_time: new Date()
            };
            const [insertResult] = await db.query("INSERT INTO users SET ?", [newUser]);
            newUser.id = insertResult.insertId;
            user = newUser;
        }

        const token = `mock_token_${user.id}`;
        return res.json({ success: true, token, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: "服务器错误", error });
    }
});

// 📌 修改用户信息
router.post("/update", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "未提供有效的 Token" });
    }
    const userId = authHeader.replace("Bearer mock_token_", "");

    try {
        const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: "用户不存在" });
        }

        await db.query("UPDATE users SET username = ?, avatar_url = ?, wxid = ? WHERE id = ?", [req.body.username, req.body.avatar_url, req.body.wxid, userId]);
        const [updatedUser] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
        return res.json({ success: true, message: "用户信息更新成功", user: updatedUser[0] });
    } catch (err) {
        return res.status(500).json({ success: false, message: "服务器错误" });
    }
});

// 📌 获取用户信息
router.get("/info", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "未提供有效的 Token" });
    }
    const userId = authHeader.replace("Bearer mock_token_", "");

    try {
        const [results] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "用户不存在" });
        }
        return res.json({ success: true, user: results[0] });
    } catch (err) {
        return res.status(500).json({ success: false, message: "数据库错误" });
    }
});

module.exports = router;