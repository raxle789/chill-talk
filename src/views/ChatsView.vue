<script setup lang="ts">
import {
  SendHorizontal,
  MessageSquareText,
  SquarePen,
  LogOut,
  CircleX,
  MessageSquarePlus,
  ArrowLeft,
  AlignJustify,
  // CheckCheck,
} from 'lucide-vue-next'
import {
  signOutUser,
  sendFirstMessage,
  sendMessage,
  dbRealtime,
  makeNewRoom,
  markMessageAsRead,
  addOrChangeUserData,
  getUserField,
  updateDisplayName,
} from '@/lib/firebase.utils'
import { useRouter } from 'vue-router'
import Cookies from 'js-cookie'
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getUserDataFromCookies } from '@/lib/js-cookie.utils'
import { ref as dbRef, onChildAdded, off, get, onValue } from 'firebase/database'
import type { DatabaseReference } from 'firebase/database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import type { TUserData } from './HomeView.vue'

type TMessage = {
  senderId: string
  message: string
  timestamp: number
  readBy: {
    [userId: string]: boolean
  }
}

type TChatList = {
  firstPersonId: string
  firstPersonName: string
  lastMessage: string
  lastSenderId: string
  lastTimestamp: number
  roomId: string
  secondPersonId: string
  secondPersonName: string
}

type TAvatars = {
  [roomId: string]: { avatar: string }
}

// State
const router = useRouter()
const user = useUserStore()
const menu = ref('chats')
const messageInput = ref('')
const messageInputRef = ref<HTMLInputElement | null>(null)
const roomId = ref('')
const recipientId = ref('')
const recipientName = ref('')
const chatList = ref<TChatList[]>([])
const avatars = ref<TAvatars>({})
const messages = ref<TMessage[]>([])
const modalRef = ref<HTMLDialogElement | null>(null)
const loading = ref(false)
const toastState = ref(false)
const warningAlert = ref(false)
const editState = ref(false)
const formData = ref({
  displayName: user.displayName,
  avatar: null as File | null,
})
const widthDevice = ref(0)
let firebaseRef: DatabaseReference | null = null

// Functions
const handleEditSubmit = async () => {
  loading.value = true
  try {
    if (formData.value.avatar) {
      const formDataCloudinary = new FormData()
      formDataCloudinary.append('file', formData.value.avatar)
      formDataCloudinary.append('upload_preset', 'cloudinary-files')
      formDataCloudinary.append('cloud_name', 'dmphgf3hg')

      const response = await fetch('https://api.cloudinary.com/v1_1/dmphgf3hg/image/upload', {
        method: 'POST',
        body: formDataCloudinary,
      })
      const data = await response.json()
      // console.log('res cloudinary: ', data.secure_url)

      // Update user data
      await addOrChangeUserData(user.uid, {
        displayName: formData.value.displayName,
        email: user.email,
        avatar: data.secure_url,
      })

      const cookiesData: TUserData = {
        uid: user.uid,
        email: user.email,
        displayName: formData.value.displayName,
        avatar: data.secure_url,
      }

      Cookies.set('simpleChatApp-userData', JSON.stringify(cookiesData), {
        expires: 3,
      })

      // Update local store
      user.setUser({
        ...user,
        displayName: formData.value.displayName,
        avatar: data.secure_url,
      })

      // Toggle edit mode
      editState.value = false
    } else {
      await updateDisplayName(user.uid, formData.value.displayName)
      const cookiesData: TUserData = {
        uid: user.uid,
        email: user.email,
        displayName: formData.value.displayName,
        avatar: user.avatar,
      }

      Cookies.set('simpleChatApp-userData', JSON.stringify(cookiesData), {
        expires: 3,
      })

      // Update local store
      user.setUser({
        ...user,
        displayName: formData.value.displayName,
      })

      // Toggle edit mode
      editState.value = false
    }
  } catch (error) {
    console.error('Error updating profile:', error)
  }
  loading.value = false
}

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    const file = input.files[0]
    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      input.value = '' // Reset input
      return
    }
    // Validasi ukuran file (optional, misal max 2MB)
    if (file.size > 0.3 * 1024 * 1024) {
      warningAlert.value = true
      setTimeout(() => {
        warningAlert.value = false
      }, 3000)
      // alert('File size should be less than 300kb')
      input.value = ''
      return
    }
    formData.value.avatar = file
  }
}

const handleSignOut = async () => {
  await signOutUser()
  // Remove user data from cookies
  Cookies.remove('simpleChatApp-userData')
  user.clearUser()
  router.replace('/')
}

const changeMenu = (value: string) => {
  if (value === 'chats') {
    menu.value = 'chats'
  } else {
    menu.value = 'profile'
  }
}

const handleNewChatSubmit = async (e: Event) => {
  e.preventDefault()
  loading.value = true
  const form = e.target as HTMLFormElement
  const recipientId = (form.recipientId as HTMLInputElement).value
  const message = (form.message as HTMLInputElement).value

  const roomId = uuidv4()
  await makeNewRoom(roomId, user.uid, user.displayName, recipientId, message)
  await sendFirstMessage(roomId, user.uid, message, recipientId)

  form.reset()
  modalRef?.value?.close()
  loading.value = false
  listenToChatRoom(roomId)
}

const handleSendMessage = async () => {
  if (messageInput.value.trim()) {
    await sendMessage(roomId.value, user.uid, recipientId.value, messageInput.value)
    messageInput.value = ''
  }
}

const handleRoomClick = async (id: string) => {
  if (id !== roomId.value) {
    if (firebaseRef) off(firebaseRef)
    roomId.value = id
    messages.value = []
    chatList.value.find((chat: TChatList) => {
      if (chat.roomId === id) {
        if (chat.firstPersonId === user.uid) {
          recipientName.value = chat.secondPersonName
          recipientId.value = chat.secondPersonId
        } else {
          recipientName.value = chat.firstPersonName
          recipientId.value = chat.firstPersonId
        }
      }
    })
    getMessages()
    listenToMessages()
    // if (widthDevice.value > 1023) {
    await nextTick(() => {
      messageInputRef.value?.focus()
    })
    // }
  }
}

const getChatList = async () => {
  const chatListRef = dbRef(dbRealtime, `userRooms/${user.uid}`)
  const listSnap = await get(chatListRef)
  // console.log('listSnap: ', listSnap.val())
  const result = listSnap.val()
  delete result.displayName

  let list: TChatList[] = []
  Object.values(result as any).map((item: any, index: number) =>
    list.push({ roomId: Object.keys(result)[index], ...item }),
  )
  // console.log('list: ', list)
  if (list.length > 0) {
    const result = Object.entries(list)
      .map(([roomId, roomData]: any) => ({
        roomId,
        ...roomData,
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
    let avatarsObj: { [key: string]: { avatar: string } } = {}

    await Promise.all(
      result.map(async (item) => {
        listenToChatRoom(item.roomId)
        let userData = null
        if (item.firstPersonId === user.uid) {
          userData = await getUserField(item.secondPersonId)
        } else {
          userData = await getUserField(item.firstPersonId)
        }

        if (userData) {
          avatarsObj[item.roomId] = {
            avatar: userData.avatar,
          }
        }
      }),
    )

    // Set ke state
    avatars.value = avatarsObj
  } else {
    chatList.value = list
  }

  // console.log('chatlist: ', chatList.value)
}

const listenToChatList = () => {
  const userRoomsRef = dbRef(dbRealtime, `userRooms/${user.uid}`)

  onValue(userRoomsRef, async (snapshot) => {
    const data = snapshot.val()
    delete data.displayName
    // console.log('data: ', data)
    // console.log(data.lastMessage)
    if (data) {
      const result = Object.entries(data)
        .map(([roomId, roomData]: any) => ({
          roomId,
          ...roomData,
        }))
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      const newItems = result.filter(
        (newItem) =>
          !chatList.value.some((existingItem: TChatList) => existingItem.roomId === newItem.roomId),
      )
      chatList.value = result

      if (newItems.length > 0) {
        let avatarsObj: { [key: string]: { avatar: string } } = { ...avatars.value }
        await Promise.all(
          newItems.map(async (item) => {
            let userData = null
            if (item.firstPersonId === user.uid) {
              userData = await getUserField(item.secondPersonId)
            } else {
              userData = await getUserField(item.firstPersonId)
            }

            if (userData) {
              avatarsObj[item.roomId] = {
                avatar: userData.avatar,
              }
            }
          }),
        )

        // Set ke state
        avatars.value = avatarsObj
      }
    } else {
      chatList.value = []
    }
  })
}

const listenToChatRoom = (roomId: string) => {
  const chatRoomsRef = dbRef(dbRealtime, `userRooms/${user.uid}/${roomId}`)

  onValue(chatRoomsRef, (snapshot) => {
    const newRoomData = snapshot.val()
    if (!newRoomData) return

    // Tambahkan roomId ke dalam data
    const newRoom = {
      roomId,
      ...newRoomData,
    }

    // Hapus entry lama jika ada yang punya roomId sama
    const filtered = JSON.parse(JSON.stringify(chatList.value)).filter(
      (item: TChatList) => item.roomId !== roomId,
    )

    // Gabungkan dan urutkan berdasarkan timestamp
    const updatedList = [...filtered, newRoom].sort((a, b) => b.lastTimestamp - a.lastTimestamp)

    // Update chatList
    chatList.value = updatedList
  })
}

const getMessages = async () => {
  firebaseRef = dbRef(dbRealtime, `chats/${roomId.value}`)
  const result = await get(firebaseRef)
  // console.log('firebaseRef:', firebaseRef)
  const messagesQuery = result.val()
  const keys = Object.keys(messagesQuery)
  const lastKey = keys[keys.length - 1]
  // console.log('Key terbaru:', lastKey)

  messages.value = Object.values(result.val() as Record<string, TMessage>)
  const lengthArray = messages.value.length
  const lastMessage = messages.value[lengthArray - 1]
  if (
    lastMessage?.readBy &&
    user.uid in lastMessage.readBy &&
    lastMessage.readBy[user.uid] === false
  ) {
    messages.value[lengthArray - 1].readBy[user.uid] = true
    // console.log(messages.value[lengthArray - 1].readBy[user.uid])
    await markMessageAsRead(roomId.value, lastKey, user.uid)
  }
}

const listenToMessages = () => {
  firebaseRef = dbRef(dbRealtime, `chats/${roomId.value}`)
  onChildAdded(firebaseRef, async (snapshot) => {
    const data = snapshot.val()

    if (messages.value.length > 0) {
      const lengthArray = messages.value.length
      if (messages.value[lengthArray - 1].message !== data.message) {
        messages.value.push(data)
        if (data.senderId !== user.uid && data.readBy[user.uid] === false) {
          data.readBy[user.uid] = true
          await markMessageAsRead(roomId.value, snapshot.key as string, user.uid)
        }
      }
    }
  })
}

// Hooks
// watch(
//   messages,
//   () => {
//     console.log('messages: ', messages.value)
//   },
//   { deep: true },
// )

// watch(
//   user,
//   () => {
//     console.log('userStore state:', {
//       avatar: user.avatar,
//       uid: user.uid,
//       displayName: user.displayName,
//       email: user.email,
//     })
//   },
//   { deep: true },
// )

// watch(
//   chatList,
//   () => {
//     console.log('chatList: ', JSON.parse(JSON.stringify(chatList.value)))
//   },
//   { deep: true },
// )

onMounted(() => {
  const data = getUserDataFromCookies()
  if (data) {
    // user.value = data
    user.setUser(data)
    formData.value = { displayName: data.displayName, avatar: null }
    getChatList()
    listenToChatList()
    widthDevice.value = window.innerWidth
  } else {
    toastState.value = true
    setTimeout(() => {
      toastState.value = false
    }, 3000)
    router.replace('/')
  }
})

onBeforeUnmount(() => {
  // Hentikan listener saat komponen di-unmount
  if (firebaseRef) off(firebaseRef)
})
</script>

<template>
  <main class="flex h-screen bg-slate-100 overflow-hidden">
    <section class="hidden w-16 lg:flex flex-col justify-between items-center pt-6 pb-5">
      <div class="tooltip tooltip-right" data-tip="Chats">
        <button
          :class="['btn btn-ghost btn-circle', menu === 'chats' && 'bg-gray-200']"
          @click="changeMenu('chats')"
        >
          <MessageSquareText />
        </button>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="tooltip tooltip-right" data-tip="Profile">
          <button class="btn btn-ghost btn-circle" @click="changeMenu('profile')">
            <img
              v-if="user.avatar.length > 0"
              :src="user.avatar"
              class="w-full h-full rounded-full object-cover"
              alt="avatar-image-profile"
            />
            <div v-else class="avatar avatar-placeholder w-full h-full rounded-full">
              <div
                class="bg-neutral text-neutral-content rounded-full flex items-center justify-center"
              >
                <span class="text-2xl">{{ user.displayName.substring(0, 1) }}</span>
              </div>
            </div>
          </button>
        </div>
        <div class="tooltip tooltip-right" data-tip="Logout">
          <button class="btn btn-ghost btn-circle" @click="handleSignOut">
            <LogOut />
          </button>
        </div>
      </div>
    </section>

    <section class="w-full grid grid-cols-1 md:grid-cols-8 lg:grid-cols-7">
      <div
        :class="[
          'md:col-span-3 lg:col-span-2 bg-white lg:rounded-s-4xl lg:shadow-md relative h-screen transition-transform duration-300',
          roomId && 'md:translate-x-0 -translate-x-full',
        ]"
      >
        <div v-if="menu === 'chats'">
          <div class="h-20 w-full flex justify-between items-center px-3">
            <div class="flex items-center justify-between w-full">
              <h2 class="text-xl font-bold ml-2 hidden md:block">Chats</h2>
              <button
                class="btn btn-ghost btn-circle mr-2 hidden md:inline-flex lg:hidden"
                @click="changeMenu('profile')"
              >
                <img
                  v-if="user.avatar.length > 0"
                  :src="user.avatar"
                  class="w-full h-full rounded-full object-cover"
                  alt="avatar-image-profile"
                />
                <div v-else class="avatar avatar-placeholder w-full h-full rounded-full">
                  <div
                    class="bg-neutral text-neutral-content rounded-full flex items-center justify-center"
                  >
                    <span class="text-2xl">{{ user.displayName.substring(0, 1) }}</span>
                  </div>
                </div>
              </button>
              <div class="drawer md:hidden">
                <input id="my-drawer" type="checkbox" class="drawer-toggle" />
                <!-- Drawer content -->
                <div class="drawer-content">
                  <!-- Page content here -->
                  <div class="flex items-center">
                    <label for="my-drawer" class="btn btn-ghost drawer-button">
                      <AlignJustify />
                    </label>
                    <h2 class="text-xl font-bold ml-2">Chats</h2>
                  </div>
                </div>
                <!-- Sidebar / drawer side -->
                <div class="drawer-side z-50">
                  <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
                  <!-- Sidebar content here -->
                  <div class="bg-white menu p-4 w-80 min-h-full text-base-content">
                    <div class="h-14 w-full flex items-center px-5">
                      <h2 class="text-xl font-bold">Profile</h2>
                    </div>
                    <div class="mt-3 px-2 relative">
                      <div v-if="editState === false" class="border border-gray-200 rounded-xl p-4">
                        <div class="flex flex-col gap-2">
                          <div>
                            <p class="font-semibold mb-1">Avatar</p>
                            <img
                              v-if="user?.avatar?.length > 0"
                              :src="user.avatar"
                              alt="avatar-image"
                              loading="lazy"
                              class="w-22 h-22 rounded-full object-cover"
                            />
                            <div
                              v-else
                              class="h-22 w-22 flex items-center justify-center rounded-full border border-gray-200 text-xs"
                            >
                              No Image
                            </div>
                          </div>
                          <div>
                            <p class="font-semibold">User Id</p>
                            <p>{{ user.uid }}</p>
                          </div>
                          <div>
                            <p class="font-semibold">Name</p>
                            <p>{{ user.displayName }}</p>
                          </div>
                          <div>
                            <p class="font-semibold">Email</p>
                            <p>{{ user.email }}</p>
                          </div>
                          <div class="mt-4">
                            <button class="btn btn-primary w-full" @click="handleSignOut">
                              Logout
                            </button>
                          </div>
                        </div>
                      </div>
                      <div v-else class="border border-gray-200 rounded-xl p-4">
                        <form @submit.prevent="handleEditSubmit">
                          <div class="mb-2">
                            <label for="avatar" class="font-semibold block mb-1">Avatar</label>
                            <input
                              type="file"
                              class="file-input"
                              name="avatar"
                              @change="handleFileChange"
                              accept="image/*"
                            />
                          </div>
                          <div class="mb-4">
                            <label for="displayName" class="font-semibold">Name</label>
                            <input
                              type="text"
                              placeholder="Type your name"
                              class="input"
                              name="displayName"
                              v-model="formData.displayName"
                            />
                          </div>
                          <button class="btn btn-primary" type="submit">
                            <span v-if="loading === true" class="loading loading-spinner"></span>
                            Submit
                          </button>
                        </form>
                      </div>
                      <div class="absolute top-4 right-9">
                        <a
                          class="link link-hover items-start font-semibold"
                          @click="editState = !editState"
                          >Edit</a
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="tooltip tooltip-bottom z-40" data-tip="New Chat">
              <button
                class="btn btn-ghost btn-circle hidden lg:inline-flex"
                @click="modalRef?.showModal()"
              >
                <SquarePen />
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-1 px-3">
            <div
              v-for="(item, index) in chatList"
              :key="index"
              :class="[
                'w-full hover:cursor-pointer flex items-center gap-2 px-3 py-4 rounded-xl',
                roomId === item.roomId
                  ? 'bg-gray-200 hover:bg-gray-200'
                  : 'bg-white hover:bg-gray-100',
              ]"
              @click="handleRoomClick(item.roomId)"
            >
              <div v-if="avatars[item.roomId]?.avatar?.length > 0" class="avatar">
                <div class="w-12 rounded-full">
                  <img
                    :src="avatars[item.roomId].avatar"
                    class="object-cover"
                    loading="lazy"
                    alt="avatar-image-person"
                  />
                </div>
              </div>
              <div v-else class="avatar avatar-placeholder">
                <div class="bg-neutral text-neutral-content w-12 rounded-full">
                  <span class="text-3xl">{{
                    item.firstPersonId === user.uid
                      ? item.secondPersonName.substring(0, 1)
                      : item.firstPersonName.substring(0, 1)
                  }}</span>
                </div>
              </div>

              <div class="w-full grid grid-cols-5">
                <span class="col-span-4 overflow-hidden">
                  <p class="font-semibold truncate">
                    {{
                      item.firstPersonId === user.uid ? item.secondPersonName : item.firstPersonName
                    }}
                  </p>
                  <p class="truncate text-sm">
                    {{ item.lastMessage }}
                  </p>
                </span>

                <span class="flex items-center justify-end">
                  <p class="text-xs text-gray-500">
                    {{ dayjs(item.lastTimestamp).format('HH:mm') }}
                  </p>
                </span>
              </div>
            </div>
          </div>

          <button
            class="btn btn-primary btn-circle w-[50px] h-[50px] fixed bottom-7 right-7 shadow-md lg:hidden"
            @click="modalRef?.showModal()"
          >
            <MessageSquarePlus class="w-7 h-7" />
          </button>
        </div>

        <div v-else>
          <div class="h-20 w-full flex items-center px-5">
            <button
              class="btn btn-circle btn-link hidden md:inline-flex lg:hidden mr-1"
              @click="changeMenu('chats')"
            >
              <ArrowLeft />
            </button>
            <h2 class="text-xl font-bold">Profile</h2>
          </div>
          <div class="px-5 relative">
            <div v-if="editState === false" class="border border-gray-200 rounded-xl p-4">
              <div class="flex flex-col gap-2">
                <div>
                  <p class="font-semibold mb-1">Avatar</p>
                  <img
                    v-if="user?.avatar?.length > 0"
                    :src="user.avatar"
                    alt="avatar-image"
                    loading="lazy"
                    class="w-22 h-22 rounded-full object-cover"
                  />
                  <div
                    v-else
                    class="h-22 w-22 flex items-center justify-center rounded-full border border-gray-200 text-xs"
                  >
                    No Image
                  </div>
                </div>
                <div>
                  <p class="font-semibold">User Id</p>
                  <p class="break-all">{{ user.uid }}</p>
                </div>
                <div>
                  <p class="font-semibold">Name</p>
                  <p class="break-all">{{ user.displayName }}</p>
                </div>
                <div>
                  <p class="font-semibold">Email</p>
                  <p class="break-all">{{ user.email }}</p>
                </div>
                <div class="mt-4 lg:hidden">
                  <button class="btn btn-primary w-full" @click="handleSignOut">Logout</button>
                </div>
              </div>
            </div>
            <div v-else class="border border-gray-200 rounded-xl p-4">
              <form @submit.prevent="handleEditSubmit">
                <div class="mb-2">
                  <label for="avatar" class="font-semibold block mb-1">Avatar</label>
                  <input
                    type="file"
                    class="file-input"
                    name="avatar"
                    @change="handleFileChange"
                    accept="image/*"
                  />
                </div>
                <div class="mb-4">
                  <label for="displayName" class="font-semibold">Name</label>
                  <input
                    type="text"
                    placeholder="Type your name"
                    class="input"
                    name="displayName"
                    v-model="formData.displayName"
                  />
                </div>
                <button class="btn btn-primary" type="submit">
                  <span v-if="loading === true" class="loading loading-spinner"></span> Submit
                </button>
              </form>
            </div>
            <div class="absolute top-4 right-9">
              <a class="link link-hover items-start font-semibold" @click="editState = !editState"
                >Edit</a
              >
            </div>
          </div>
        </div>
      </div>

      <div
        :class="[
          'md:relative md:col-span-5 lg:col-span-5 bg-slate-100 z-30 w-full h-screen transition-transform duration-300',
          roomId ? 'translate-x-0 relative' : 'translate-x-full md:translate-x-0 fixed',
        ]"
      >
        <div v-if="roomId !== ''" class="flex flex-col h-screen">
          <div class="navbar bg-primary shadow-sm flex-none px-4">
            <div class="flex items-center gap-3">
              <div>
                <button
                  class="btn btn-circle btn-link text-white inline-flex md:hidden"
                  @click="roomId = ''"
                >
                  <ArrowLeft />
                </button>
                <div v-if="avatars[roomId]?.avatar?.length > 0" class="avatar">
                  <div class="w-10 rounded-full">
                    <img
                      :src="avatars[roomId].avatar"
                      class="object-cover"
                      loading="lazy"
                      alt="avatar-image-person"
                    />
                  </div>
                </div>
                <div v-else class="avatar avatar-placeholder">
                  <div class="bg-neutral text-neutral-content w-10 rounded-full">
                    <span class="text-3xl">{{ recipientName.substring(0, 1) }}</span>
                  </div>
                </div>
              </div>
              <p class="text-lg font-semibold text-white">{{ recipientName }}</p>
            </div>
          </div>
          <div class="flex-1 overflow-hidden">
            <div class="h-full overflow-y-auto p-3 flex flex-col-reverse">
              <div
                v-for="(item, index) in messages.slice().reverse()"
                :key="index"
                :class="['chat', item.senderId === user.uid ? 'chat-end' : 'chat-start']"
              >
                <div
                  :class="[
                    'chat-bubble',
                    item.senderId === user.uid ? 'chat-bubble-neutral' : 'chat-bubble-secondary',
                  ]"
                >
                  {{ item.message }}
                  <!-- <span class="text-xs text-gray-400 ml-2 inline-flex items-center gap-1" -->
                  <span class="text-xs text-gray-400 ml-2"
                    >{{ dayjs(item.timestamp).format('HH:mm') }}
                    <!-- <span v-if="item.senderId === user.uid">
                        <CheckCheck
                          :class="[
                            'w-auto h-4 inline',
                            item.readBy[recipientId] === true ? 'text-[#0069ff]' : 'text-zinc-300',
                          ]"
                        />
                      </span> -->
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex-none p-3 flex items-center gap-2">
            <label class="input w-full">
              <input
                ref="messageInputRef"
                type="text"
                class="grow"
                v-model="messageInput"
                @keydown.enter="handleSendMessage"
                placeholder="Type a message"
              />
              <SendHorizontal v-if="widthDevice > 1023" />
            </label>
            <button
              v-if="widthDevice < 1024"
              class="btn btn-primary btn-circle"
              @click="handleSendMessage"
            >
              <SendHorizontal />
            </button>
          </div>
        </div>

        <div v-else class="h-screen flex items-center justify-center">
          <p class="text-lg font-bold hidden md:block">Chat Section</p>
        </div>
      </div>
    </section>

    <dialog id="new_chat_modal" class="modal" ref="modalRef">
      <div class="modal-box">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="text-lg font-bold">New Chat</h3>
        <form @submit="handleNewChatSubmit">
          <fieldset class="fieldset mt-2">
            <legend class="fieldset-legend">Recipient Id</legend>
            <input
              type="text"
              class="input w-full"
              name="recipientId"
              placeholder="Type the recipient id"
            />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Message</legend>
            <input type="text" class="input w-full" name="message" placeholder="Type a message" />
          </fieldset>
          <div class="flex justify-end mt-2">
            <button class="btn btn-primary" type="submit">
              <span v-if="loading === true" class="loading loading-spinner"></span> Send
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <div v-if="toastState === true" class="toast toast-top toast-center z-60">
      <div role="alert" class="alert bg-white">
        <CircleX class="text-red-500" />
        <span>No user data found!</span>
      </div>
    </div>

    <div v-if="warningAlert === true" class="toast toast-top toast-center z-60">
      <div role="alert" class="alert bg-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 shrink-0 stroke-current text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>File size should be less than 300kb!</span>
      </div>
    </div>
  </main>
</template>
