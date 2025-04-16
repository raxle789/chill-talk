import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'
import { getDatabase, ref, push, set, update, get } from 'firebase/database'
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Authentication
const provider = new GoogleAuthProvider()
provider.setCustomParameters({
  prompt: 'select_account',
})
export const auth = getAuth()
export const PopupSignIn = () => signInWithPopup(auth, provider)
export const signOutUser = async () => await signOut(auth)

// Firestore
const dbFirestore = getFirestore(app)

export type TUserDoc = {
  displayName: string | null
  email: string | null
  avatar: string
}

export const updateDisplayName = async (uid: string, displayName: string) => {
  const userDocRef = doc(dbFirestore, 'users', uid)
  await updateDoc(userDocRef, { displayName: displayName })
}

export const addOrChangeUserData = async (uid: string, objectsToAdd: TUserDoc) => {
  const userDocRef = doc(dbFirestore, 'users', uid)
  await setDoc(userDocRef, objectsToAdd, { merge: true })
}

export const getUserField = async (uid: string) => {
  const userDocRef = doc(dbFirestore, 'users', uid)
  const docSnapshot = await getDoc(userDocRef)
  if (docSnapshot.exists()) {
    return docSnapshot.data()
  } else {
    return null
  }
}

// Realtime database
export const dbRealtime = getDatabase(app)
export const makeUserRoom = async (userId: string, name: string) => {
  const userRef = ref(dbRealtime, `userRooms/${userId}`)
  await set(userRef, { displayName: name })
}

export const makeNewRoom = async (
  roomId: string,
  senderId: string,
  firstPersonName: string,
  recipientId: string,
  messageText: string,
) => {
  const listRef1 = ref(dbRealtime, `userRooms/${senderId}/${roomId}`)
  const listRef2 = ref(dbRealtime, `userRooms/${recipientId}/${roomId}`)
  const userData = await getUserField(recipientId)
  const timestamp = Date.now()

  if (userData) {
    await set(listRef1, {
      lastMessage: messageText,
      lastTimestamp: timestamp,
      lastSenderId: senderId,
      firstPersonId: senderId,
      firstPersonName: firstPersonName,
      secondPersonId: recipientId,
      secondPersonName: userData.displayName,
    })
    await set(listRef2, {
      lastMessage: messageText,
      lastTimestamp: timestamp,
      lastSenderId: senderId,
      firstPersonId: senderId,
      firstPersonName: firstPersonName,
      secondPersonId: recipientId,
      secondPersonName: userData.displayName,
    })
  }
}

export const sendFirstMessage = async (
  roomId: string,
  senderId: string,
  messageText: string,
  recipientId: string,
) => {
  const roomRef = ref(dbRealtime, `chats/${roomId}`)
  await push(roomRef, {
    senderId,
    message: messageText,
    timestamp: Date.now(),
    readBy: { [recipientId]: false },
  })
}

export const sendMessage = async (
  roomId: string,
  senderId: string,
  recipientId: string,
  messageText: string,
) => {
  const timestamp = Date.now()
  const messageIdRef = ref(dbRealtime, `chats/${roomId}`)

  // 1. Simpan pesan baru
  await push(messageIdRef, {
    senderId,
    message: messageText,
    timestamp: timestamp,
    readBy: { [senderId]: true, [recipientId]: false },
  })

  const metadataRef = ref(dbRealtime, `userRooms/${senderId}/${roomId}`)
  const snapshot = await get(metadataRef)

  // 2. Update metadata di kedua user (trigger onValue/onChildChanged)
  const metadataData: any = snapshot.val()
  const newMetadata = {
    ...metadataData,
    lastMessage: messageText,
    lastTimestamp: timestamp,
    lastSenderId: senderId,
  }

  await update(ref(dbRealtime), {
    [`userRooms/${senderId}/${roomId}`]: newMetadata,
    [`userRooms/${recipientId}/${roomId}`]: newMetadata,
  })
}

export const markMessageAsRead = async (roomId: string, messageId: string, userId: string) => {
  const readRef = ref(dbRealtime, `chats/${roomId}/${messageId}/readBy/${userId}`)
  await set(readRef, true)
}
