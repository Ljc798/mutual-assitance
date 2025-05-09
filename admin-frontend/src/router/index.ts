import { createRouter, createWebHistory } from 'vue-router'
import Login from '../pages/login.vue'
import Layout from '../Layout.vue'

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: 'dashboard',
        component: () => import('@/pages/dashboard.vue')
      },
      {
        path: 'users',
        component: () => import('@/pages/users.vue')
      },
      {
        path: 'tasks',
        component: () => import('@/pages/tasks.vue')
      },
      {
        path: 'posts',
        component: () => import('@/pages/posts.vue')
      },
      {
        path: 'pay',
        component: () => import('@/pages/pay.vue')
      },
      {
        path: '/review',
        name: 'ReviewCenter',
        component: () => import('@/pages/index.vue')
      }
    ]
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})  

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router