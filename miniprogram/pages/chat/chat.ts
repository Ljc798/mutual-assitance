Page({
    data: {
        targetId: '',
        targetName: '',
        userId: '',
        messages: [],
        inputText: '',
        socketOpen: false,
        socketUrl: '',
        scrollIntoView: 'bottom-anchor',
        lastSelfMessageId: null,
        lastReadMessageId: null,
    },

    onLoad(options) {
        const app = getApp();
        const userId = Number(app.globalData.userInfo?.id);
        const targetId = Number(options.targetId);
        const targetName = options.targetName || '对方用户';
        const room_id = this.getRoomId(userId, targetId);

        if (!userId || !targetId) {
            wx.showToast({ title: '聊天对象缺失', icon: 'none' });
            return;
        }

        this.setData({
            userId,
            targetId,
            targetName,
            room_id,
            socketUrl: `wss://mutualcampus.top/ws?userId=${userId}`,
        });

        this.fetchHistoryMessages();
        this.initWebSocket();
    },

    onUnload() {
        this.stopHeartbeat();
        wx.closeSocket();
    },

    onHide() {
        this.stopHeartbeat();
    },

    onShow() {
        wx.getNetworkType({
            success: (res) => {
                if (res.networkType !== 'none' && !this.data.socketOpen) {
                    this.reconnectWebSocket();
                }
            }
        });

        wx.nextTick(() => {
            this.scrollToBottom();
        });

        this.checkReadStatus();
    },

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.data.socketOpen) {
                wx.sendSocketMessage({ data: JSON.stringify({ type: 'ping' }) });
            }
        }, 30000);
    },

    stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    },

    reconnectWebSocket() {
        this.setData({ socketOpen: false });
        wx.closeSocket();
        setTimeout(() => this.initWebSocket(), 1000);
    },

    getRoomId(userA, userB) {
        return `room_${[userA, userB].sort((a, b) => a - b).join('_')}`;
    },

    fetchHistoryMessages() {
        const { room_id, userId } = this.data;
        wx.request({
            url: `https://mutualcampus.top/api/messages/history`,
            method: 'GET',
            data: { room_id },
            success: (res) => {
                if (res.data.success && Array.isArray(res.data.messages)) {
                    const history = res.data.messages.map((msg) => {
                        const date = new Date(msg.created_time);
                        date.setHours(date.getHours() - 8);
                        const hours = date.getHours().toString().padStart(2, '0');
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        return {
                            ...msg,
                            isSelf: msg.sender_id === userId,
                            created_time_formatted: `${hours}:${minutes}`,
                        };
                    });

                    const lastSelfMessage = [...history].reverse().find(msg => msg.isSelf);

                    this.setData({
                        messages: history,
                        lastSelfMessageId: lastSelfMessage ? lastSelfMessage.id : null,
                    }, () => {
                        wx.nextTick(() => {
                            this.scrollToBottom();
                            this.markMessagesAsRead();
                            this.sendReadAck();
                        });
                    });
                }
            }
        });
    },

    initWebSocket() {
        wx.connectSocket({ url: this.data.socketUrl });

        wx.onSocketOpen(() => {
            this.setData({ socketOpen: true });
            this.startHeartbeat();

            wx.sendSocketMessage({
                data: JSON.stringify({ type: 'init', userId: this.data.userId })
            });
        });

        wx.onSocketMessage((res) => {
            const msg = JSON.parse(res.data);
            if (msg.type === 'read_ack') {
                if (msg.room_id === this.data.room_id) {
                    const updated = this.data.messages.map(m =>
                        m.sender_id === this.data.userId ? { ...m, is_read: true } : m
                    );
                    this.setData({ messages: updated });
                }
                return;
            }

            if (msg.selfEcho) return;

            const { userId, targetId } = this.data;
            const from = Number(msg.sender_id);
            const to = Number(msg.receiver_id);
            const localUserId = Number(userId);
            const localTargetId = Number(targetId);

            if (![from, to].includes(localUserId) || ![from, to].includes(localTargetId)) return;

            const date = new Date(msg.created_time);
            date.setHours(date.getHours() - 8);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            const newMsg = {
                ...msg,
                isSelf: from === userId,
                is_read: true,
                created_time_formatted: `${hours}:${minutes}`,
            };

            this.setData({
                messages: [...this.data.messages, newMsg]
            }, this.scrollToBottom);

            this.markMessagesAsRead();
            this.sendReadAck();
        });
    },

    sendReadAck() {
        const { userId, targetId, room_id, socketOpen } = this.data;
        if (!socketOpen) return;
        wx.sendSocketMessage({
            data: JSON.stringify({ type: 'read_ack', from: userId, to: targetId, room_id })
        });
    },

    checkReadStatus() {
        const { room_id } = this.data;
        wx.request({
            url: `https://mutualcampus.top/api/messages/read-status`,
            method: 'GET',
            data: { room_id },
            success: (res) => {
                const lastReadId = res.data.last_read_message_id;
                this.setData({ lastReadMessageId: lastReadId });
            }
        });
    },

    markMessagesAsRead() {
        const { room_id, userId } = this.data;
        wx.request({
            url: 'https://mutualcampus.top/api/messages/mark-read',
            method: 'POST',
            data: { room_id, user_id: userId }
        });
    },

    onInput(e) {
        this.setData({ inputText: e.detail.value });
    },

    sendMessage() {
        const { inputText, userId, targetId, room_id, socketOpen } = this.data;
        if (!inputText.trim() || !socketOpen) return;

        const msg = {
            type: 'chat', userId, targetId, room_id, content: inputText
        };

        wx.sendSocketMessage({
            data: JSON.stringify(msg),
            success: () => {
                const now = new Date();
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');

                const selfMsg = {
                    ...msg,
                    sender_id: userId,
                    receiver_id: targetId,
                    isSelf: true,
                    is_read: true,
                    created_time: now.toISOString(),
                    created_time_formatted: `${hours}:${minutes}`,
                };

                this.setData({
                    messages: [...this.data.messages, selfMsg],
                    inputText: ''
                }, this.scrollToBottom);
            }
        });
    },

    scrollToBottom() {
        this.setData({ scrollIntoView: 'bottom-anchor' });
    },

    handleBack() {
        wx.navigateBack({ delta: 1 });
    },
});