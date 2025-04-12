<script setup lang="ts">
import { PopupSignIn, addOrChangeUserData, getUserField, makeUserRoom } from '@/lib/firebase.utils'
import { useRouter } from 'vue-router'
import Cookies from 'js-cookie'
import { onMounted } from 'vue'
import { getUserDataFromCookies } from '@/lib/js-cookie.utils'

export type TUserData = {
  uid: string
  email: string | null
  displayName: string | null
  avatar: string
}
const router = useRouter()

const handleLogInWithGoogle = async () => {
  try {
    const result = await PopupSignIn()
    if (result) {
      const data = result.user
      const userData = await getUserField(data.uid)
      if (userData) {
        const cookiesData: TUserData = {
          uid: data.uid,
          email: data.email,
          displayName: userData.displayName,
          avatar: userData.avatar,
        }

        // Simpan data pengguna ke dalam cookie
        Cookies.set('simpleChatApp-userData', JSON.stringify(cookiesData), {
          expires: 3,
        })
        router.push('/chats')
      } else {
        alert('Kamu sebelumnya belum login')
        console.log(userData)
      }
    }
  } catch (error) {
    console.log(error)
  }
}

const handleSignInWithGoogle = async () => {
  try {
    const result = await PopupSignIn()
    if (result) {
      const data = result.user
      const cookiesData: TUserData = {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        avatar: '',
      }
      const userSigned = {
        displayName: data.displayName,
        email: data.email,
        avatar: '',
      }

      await addOrChangeUserData(cookiesData.uid, userSigned)
      await makeUserRoom(cookiesData.uid, cookiesData.displayName || '')
      Cookies.set('simpleChatApp-userData', JSON.stringify(cookiesData), {
        expires: 3,
      })
      router.push('/chats')
    }
  } catch (error) {
    console.log(error)
  }
}

onMounted(() => {
  const data = getUserDataFromCookies()
  if (data) {
    router.push('/chats')
  }
})
</script>

<template>
  <main class="w-dvw h-dvh flex items-center justify-center">
    <div class="card w-96 bg-base-100 shadow-sm">
      <div class="card-body">
        <h2 class="text-3xl font-bold">Log in</h2>
        <div class="mt-5">
          <button
            class="btn btn-block bg-white text-black border-[#e5e5e5]"
            @click="handleLogInWithGoogle"
          >
            <svg
              aria-label="Google logo"
              width="16"
              height="16"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <g>
                <path d="m0 0H512V512H0" fill="#fff"></path>
                <path
                  fill="#34a853"
                  d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
                ></path>
                <path fill="#4285f4" d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"></path>
                <path fill="#fbbc02" d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"></path>
                <path
                  fill="#ea4335"
                  d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
                ></path>
              </g>
            </svg>
            Login with Google
          </button>
        </div>
        <p class="mt-3">Don't have an account?</p>
        <div class="mt-1">
          <button
            class="btn btn-block bg-white text-black border-[#e5e5e5]"
            @click="handleSignInWithGoogle"
          >
            <svg
              aria-label="Google logo"
              width="16"
              height="16"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <g>
                <path d="m0 0H512V512H0" fill="#fff"></path>
                <path
                  fill="#34a853"
                  d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
                ></path>
                <path fill="#4285f4" d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"></path>
                <path fill="#fbbc02" d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"></path>
                <path
                  fill="#ea4335"
                  d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
                ></path>
              </g>
            </svg>
            Signup with Google
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
