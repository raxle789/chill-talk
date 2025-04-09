<script setup lang="ts">
import { SendHorizontal, MessageSquareText, SquarePen, LogOut, CircleX } from 'lucide-vue-next'
import {
  signOutUser,
  sendFirstMessage,
  sendMessage,
  dbRealtime,
  makeNewRoom,
  markMessageAsRead,
} from '@/lib/firebase.utils'
import { useRouter } from 'vue-router'
import Cookies from 'js-cookie'
import { watch, ref, onMounted, onBeforeUnmount } from 'vue'
import { getUserDataFromCookies } from '@/lib/js-cookie.utils'
import { ref as dbRef, onChildAdded, off, get, onValue } from 'firebase/database'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

type TMessage = {
  senderId: string
  message: string
  timestamp: number
  readBy?: {
    [userId: string]: boolean
  }
}

type TChatList = {
  firstPersonId: string
  firstPersonName: string
  lastMessage: string
  lastSenderId: string
  lastTimestamp: string
  roomId: string
  secondPersonId: string
  secondPersonName: string
}

// State
const router = useRouter()
const user = ref({
  uid: '',
  email: '',
  displayName: '',
})
const menu = ref('chats')
const messageInput = ref('')
const roomId = ref('')
const recipientId = ref('')
const recipientName = ref('')
const chatList = ref<any>([])
const messages = ref<TMessage[]>([])
const modalRef = ref<HTMLDialogElement | null>(null)
const loading = ref(false)
const toastState = ref(false)
let firebaseRef: any = null

// Functions
const handleSignOut = async () => {
  await signOutUser()
  // Remove user data from cookies
  Cookies.remove('simpleChatApp-userData')
  router.replace('/')
}

const changeMenu = (value: string) => {
  if (value === 'chats') {
    menu.value = 'chats'
  } else {
    menu.value = 'profile'
  }
}

const handleNewChatSubmit = async (e: any) => {
  loading.value = true
  const form = e.target
  const recipientId = form.recipientId.value
  const message = form.message.value

  const roomId = uuidv4()
  await makeNewRoom(roomId, user.value.uid, user.value.displayName, recipientId, message)
  await sendFirstMessage(roomId, user.value.uid, message, recipientId)

  form.reset()
  modalRef?.value?.close()
  loading.value = false
  listenToChatRoom(roomId)
}

const handleSendMessage = async () => {
  if (messageInput.value.trim()) {
    await sendMessage(roomId.value, user.value.uid, recipientId.value, messageInput.value)
    messageInput.value = ''
  }
}

const handleRoomClick = (id: string) => {
  if (id !== roomId.value) {
    if (firebaseRef) off(firebaseRef)
    roomId.value = id
    messages.value = []
    chatList.value.find((chat: TChatList) => {
      if (chat.roomId === id) {
        if (chat.firstPersonId === user.value.uid) {
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
  }
}

const getChatList = async () => {
  const chatListRef = dbRef(dbRealtime, `userRooms/${user.value.uid}`)
  const listSnap = await get(chatListRef)
  console.log('listSnap: ', listSnap.val())
  const result = listSnap.val()
  delete result.displayName

  let list: any = []
  Object.values(result as any).map((item: any, index: number) =>
    list.push({ roomId: Object.keys(result)[index], ...item }),
  )
  console.log('list: ', list)
  if (list.length > 0) {
    const result = Object.entries(list)
      .map(([roomId, roomData]: any) => ({
        roomId,
        ...roomData,
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
    result.forEach((item) => listenToChatRoom(item.roomId))

    chatList.value = result
  } else {
    chatList.value = list
  }

  console.log('chatlist: ', chatList.value)
}

const listenToChatList = () => {
  const userRoomsRef = dbRef(dbRealtime, `userRooms/${user.value.uid}`)

  onValue(userRoomsRef, (snapshot) => {
    const data = snapshot.val()
    delete data.displayName
    console.log('data: ', data)
    // console.log(data.lastMessage)
    if (data) {
      const result = Object.entries(data)
        .map(([roomId, roomData]: any) => ({
          roomId,
          ...roomData,
        }))
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      console.log('result: ', result)
      chatList.value = result
    } else {
      chatList.value = []
    }
  })
}

const listenToChatRoom = (roomId: string) => {
  const chatRoomsRef = dbRef(dbRealtime, `userRooms/${user.value.uid}/${roomId}`)

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
      (item: any) => item.roomId !== roomId,
    )
    // Masukkan data terbaru ke paling depan
    chatList.value = [newRoom, ...filtered]
  })
}

const getMessages = async () => {
  firebaseRef = dbRef(dbRealtime, `chats/${roomId.value}`)
  const result = await get(firebaseRef)
  // Object.values(result.val() as Record<string, TMessage>).map((item) => messages.value.push(item))
  messages.value = Object.values(result.val() as Record<string, TMessage>)
}

const listenToMessages = () => {
  firebaseRef = dbRef(dbRealtime, `chats/${roomId.value}`)
  onChildAdded(firebaseRef, async (snapshot) => {
    const data = snapshot.val()
    if (messages.value.length > 0) {
      if (messages.value[0].message !== data.message) {
        messages.value.push(data)
      }
    }
  })
}

// Hooks
watch(
  messages,
  () => {
    console.log('messages: ', messages.value)
  },
  { deep: true },
)

watch(
  chatList,
  () => {
    console.log('chatList: ', JSON.parse(JSON.stringify(chatList.value)))
  },
  { deep: true },
)

onMounted(() => {
  const data = getUserDataFromCookies()
  if (data) {
    user.value = data
    getChatList()
    listenToChatList()
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
  <main class="flex h-screen">
    <section
      class="w-14 bg-white border-r border-gray-300 flex flex-col justify-between items-center pt-6 pb-5"
    >
      <div class="tooltip tooltip-right" data-tip="Chats">
        <button class="btn btn-ghost btn-circle" @click="changeMenu('chats')">
          <MessageSquareText />
        </button>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="tooltip tooltip-right" data-tip="Profile">
          <button class="btn btn-ghost btn-circle" @click="changeMenu('profile')">
            <img
              class="rounded-full"
              alt="Tailwind CSS Navbar component"
              src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
            />
          </button>
        </div>
        <div class="tooltip tooltip-right" data-tip="Logout">
          <button class="btn btn-ghost btn-circle" @click="handleSignOut">
            <LogOut />
          </button>
        </div>
      </div>
    </section>

    <section class="w-full grid grid-cols-7">
      <div class="border-r border-gray-300 col-span-2 bg-white">
        <div v-if="menu === 'chats'">
          <div class="h-20 w-full flex justify-between items-center px-3">
            <h2 class="text-xl font-bold">Chats</h2>
            <div class="tooltip tooltip-bottom" data-tip="New Chat">
              <button class="btn btn-ghost btn-circle" @click="modalRef?.showModal()">
                <SquarePen />
              </button>
            </div>
          </div>
          <div
            v-for="(item, index) in chatList"
            :key="index"
            :class="[
              'w-full flex items-center gap-4 border-b border-gray-300 px-3 py-4 hover:cursor-pointer',
              roomId === item.roomId
                ? 'bg-gray-200 hover:bg-gray-200'
                : 'bg-white hover:bg-gray-100',
            ]"
            @click="handleRoomClick(item.roomId)"
          >
            <div class="avatar">
              <div class="w-12 rounded-full">
                <img
                  src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                />
              </div>
            </div>
            <div class="w-full flex items-center justify-between">
              <span>
                <p class="font-semibold">
                  {{
                    item.firstPersonId === user.uid ? item.secondPersonName : item.firstPersonName
                  }}
                </p>
                <p>{{ item.lastMessage }}</p>
              </span>
              <span class="flex item-center">
                <!-- <span
                  class="w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full"
                  >1</span
                > -->
                <p>{{ dayjs(item.lastTimestamp).format('HH:mm') }}</p>
              </span>
            </div>
          </div>
        </div>

        <div v-else>
          <div class="h-20 w-full flex items-center px-3">
            <h2 class="text-xl font-bold">Profile</h2>
          </div>
        </div>
      </div>

      <div class="col-span-5">
        <div class="flex flex-col h-screen" v-if="roomId !== ''">
          <div class="navbar bg-primary shadow-sm flex-none px-4">
            <div class="flex items-center gap-3">
              <div class="avatar">
                <div class="w-10 rounded-full">
                  <img
                    src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                  />
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
                  <span v-if="item.senderId === user.uid" class="text-xs text-gray-400 mr-2">{{
                    dayjs(item.timestamp).format('HH:mm')
                  }}</span>
                  {{ item.message }}
                  <span v-if="item.senderId !== user.uid" class="text-xs text-gray-400 ml-2">{{
                    dayjs(item.timestamp).format('HH:mm')
                  }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex-none p-3">
            <label class="input w-full">
              <input
                type="text"
                class="grow"
                v-model="messageInput"
                @keydown.enter="handleSendMessage"
                placeholder="Type a message"
              />
              <SendHorizontal />
            </label>
          </div>
        </div>

        <div class="h-screen flex items-center justify-center" v-else>
          <p class="text-lg font-bold">Chat Section</p>
        </div>
      </div>
    </section>

    <dialog id="new_chat_modal" class="modal" ref="modalRef">
      <div class="modal-box">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="text-lg font-bold">New Chat</h3>
        <form @submit.prevent="handleNewChatSubmit">
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

    <div v-if="toastState === true" class="toast toast-top toast-center">
      <div role="alert" class="alert alert-error alert-soft">
        <CircleX />
        <span>No user data found!</span>
      </div>
    </div>
  </main>
</template>
