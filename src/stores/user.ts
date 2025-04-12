import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    avatar: '',
    uid: '',
    displayName: '',
    email: '',
  }),
  actions: {
    setUser(data: { avatar: string; uid: string; displayName: string; email: string }) {
      this.avatar = data.avatar
      this.uid = data.uid
      this.displayName = data.displayName
      this.email = data.email
    },
    clearUser() {
      this.avatar = ''
      this.uid = ''
      this.displayName = ''
      this.email = ''
    },
  },
  persist: true,
})
