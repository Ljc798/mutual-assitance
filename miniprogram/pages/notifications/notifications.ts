Page({
    data: {
        notifications: []
    },

    onLoad() {
        this.fetchNotifications();
    },

    fetchNotifications() {
        const token = wx.getStorageSync('token');
        wx.request({
          url: 'https://mutualcampus.top/api/notification/all',
          method: 'GET',
          header: {
            Authorization: `Bearer ${token}`
          },
          success: (res) => {
            if (res.data.success) {
              const colorMap = {
                system: '#e3f2fd',
                like: '#fff8e1',
                comment: '#e8f5e9',
                task: '#fff3e0'
              };
    
              const updated = res.data.notifications.map((n) => {
                const base = colorMap[n.type] || '#ffffff';
                return {
                  ...n,
                  background: n.is_read ? '#f5f5f5' : base
                };
              });
    
              this.setData({ notifications: updated });
            }
          }
        });
      },

    handleBack() {
        wx.navigateBack({ delta: 1 });
    },

    markAsRead(e) {
        const id = e.currentTarget.dataset.id;
        const token = wx.getStorageSync('token');
      
        wx.request({
          url: `https://mutualcampus.top/api/notification/mark-read`,
          method: 'POST',
          header: {
            Authorization: `Bearer ${token}`
          },
          data: {
              id
          },
          success: (res) => {
            if (res.statusCode === 200) {
              // 👇 手动更新本地数据
              const notifications = this.data.notifications.map((n) => {
                if (n.id === id) {
                  return {
                    ...n,
                    is_read: 1,
                    background: '#f5f5f5'
                  };
                }
                return n;
              });
              this.setData({ notifications });
            } else {
              wx.showToast({ title: "标记失败", icon: "none" });
            }
          },
          fail: () => {
            wx.showToast({ title: "网络错误", icon: "none" });
          }
        });
      }
});