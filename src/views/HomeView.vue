<script setup lang="ts">
import { PopupSignIn, addOrChangeUserData, getUserField, makeUserRoom } from '@/lib/firebase.utils'
import { CircleX } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import Cookies from 'js-cookie'
import { onMounted, ref } from 'vue'
import { getUserDataFromCookies } from '@/lib/js-cookie.utils'
import people1 from '@/assets/potrait-images/people1.jpg'
import people2 from '@/assets/potrait-images/people2.jpg'
import people3 from '@/assets/potrait-images/people3.jpg'
import people4 from '@/assets/potrait-images/people4.jpg'
import people5 from '@/assets/potrait-images/people5.jpg'
import people6 from '@/assets/potrait-images/people6.jpg'
import arabian from '@/assets/potrait-images/arabian.jpg'
import korean from '@/assets/potrait-images/korean2.png'
import african from '@/assets/potrait-images/african.png'

export type TUserData = {
  uid: string
  email: string | null
  displayName: string | null
  avatar: string
}
const router = useRouter()
const toastState = ref(false)

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
        toastState.value = true
        setTimeout(() => {
          toastState.value = false
        }, 3000)
        // alert('You need to signup first!')
        // console.log(userData)
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
  <main class="w-dvw h-dvh flex items-center justify-around flex-wrap px-5 md:px-0">
    <div class="flex items-center">
      <div class="text-4xl font-bold">
        Chill
        <!-- Chill <span class="bg-blue-500 text-white px-3 pt-[2px] pb-[6px] rounded-xl">Talk</span> -->
      </div>
      <div class="chat chat-start">
        <div class="chat-bubble chat-bubble-primary">
          <span class="mr-2 text-4xl font-bold text-white">Talk</span>
        </div>
      </div>
    </div>
    <div class="card w-96 bg-base-100 shadow-sm">
      <div class="card-body">
        <h2 class="text-3xl font-bold">Login</h2>
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

    <div class="items-center gap-1 absolute top-25 left-15 hidden md:flex">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people5" loading="lazy" />
        </div>
      </div>
      <div>
        <div class="chat chat-start">
          <div class="chat-bubble chat-bubble-secondary"><span class="mr-2">Hello</span></div>
        </div>
      </div>
    </div>
    <div class="absolute top-40 left-90 hidden lg:block">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people6" loading="lazy" />
        </div>
      </div>
    </div>
    <div class="items-center gap-1 absolute top-15 -translate-x-1/2 left-1/2 hidden md:flex">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people3" loading="lazy" />
        </div>
      </div>
      <div>
        <div class="chat chat-start">
          <div class="chat-bubble"><span class="mr-2">Bonjour</span></div>
        </div>
      </div>
    </div>
    <div class="absolute top-30 right-90 hidden lg:block">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover object-center" :src="people2" loading="lazy" />
        </div>
      </div>
    </div>
    <div class="items-center gap-1 absolute top-21 right-20 hidden md:flex">
      <div>
        <div class="chat chat-end">
          <div class="chat-bubble chat-bubble-accent">
            <span class="mr-2 text-[#e8eff8]">مرحبا</span>
          </div>
        </div>
      </div>
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="arabian" loading="lazy" />
        </div>
      </div>
    </div>
    <div class="items-center gap-1 absolute bottom-30 left-35 hidden md:flex">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="african" loading="lazy" />
        </div>
      </div>
      <div>
        <div class="chat chat-start">
          <div class="chat-bubble chat-bubble-neutral"><span class="mr-2">Hujambo</span></div>
        </div>
      </div>
    </div>
    <div class="absolute bottom-10 left-120 hidden xl:block">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people1" loading="lazy" />
        </div>
      </div>
    </div>
    <div class="items-center gap-1 absolute bottom-20 right-90 hidden md:flex">
      <div>
        <div class="chat chat-end">
          <div class="chat-bubble chat-bubble-primary">
            <span class="mr-2 whitespace-nowrap">안녕하세요</span>
          </div>
        </div>
      </div>
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="korean" loading="lazy" />
        </div>
      </div>
    </div>
    <div class="absolute bottom-10 right-40 hidden md:block">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people4" loading="lazy" />
        </div>
      </div>
    </div>

    <!-- <div class="absolute top-30"> -->
    <div class="items-center gap-1 absolute top-45 left-15 flex md:hidden">
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people5" loading="lazy" />
        </div>
      </div>
      <div>
        <div class="chat chat-start">
          <div class="chat-bubble chat-bubble-secondary"><span class="mr-2">Hello</span></div>
        </div>
      </div>
    </div>
    <div class="items-center gap-1 absolute top-55 right-15 flex md:hidden">
      <div>
        <div class="chat chat-end">
          <div class="chat-bubble"><span class="mr-2">Bonjour</span></div>
        </div>
      </div>
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img class="object-cover" :src="people3" loading="lazy" />
        </div>
      </div>
    </div>
    <!-- </div> -->

    <div v-if="toastState === true" class="toast toast-top toast-center z-60">
      <div role="alert" class="alert bg-white">
        <CircleX class="text-red-500" />
        <span>You need to signup first!</span>
      </div>
    </div>
  </main>
</template>
