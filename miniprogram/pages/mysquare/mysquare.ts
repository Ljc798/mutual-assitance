Page({
    data: {
        posts: []
    },

    onLoad() {
        this.fetchMyPosts();
    },

    fetchMyPosts() {
        const token = wx.getStorageSync("token");
        wx.request({
            url: "https://mutualcampus.top/api/square/mine",
            method: "GET",
            header: { Authorization: `Bearer ${token}` },
            success: (res) => {
                if (res.data.success) {
                    const formattedPosts = res.data.posts.map(post => ({
                        ...post,
                        formattedTime: this.formatTime(post.created_time)
                    }));
                    this.setData({ posts: formattedPosts });
                } else {
                    wx.showToast({ title: "获取失败", icon: "none" });
                }
            }
        });
    },

    formatTime(timeStr: string): string {
        const date = new Date(timeStr);
        date.setHours(date.getHours() - 8);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    },

    handleDelete(e) {
        const id = e.currentTarget.dataset.id;
        const token = wx.getStorageSync("token");

        wx.showModal({
            title: "确认删除",
            content: "确定要删除这条动态吗？",
            success: (res) => {
                if (res.confirm) {
                    wx.request({
                        url: "https://mutualcampus.top/api/square/delete",
                        method: "POST",
                        header: { Authorization: `Bearer ${token}` },
                        data: { post_id: id },
                        success: (res) => {
                            if (res.data.success) {
                                wx.showToast({ title: "删除成功", icon: "success" });
                                this.fetchMyPosts();
                            } else {
                                wx.showToast({ title: "删除失败", icon: "none" });
                            }
                        }
                    });
                }
            }
        });
    },

    handleEdit(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/mysquare/edit?postId=${id}`
        });
    },

    handleBack() {
        wx.navigateBack({ delta: 1 });
    }
});