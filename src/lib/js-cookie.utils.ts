import Cookies from 'js-cookie'

export const getUserDataFromCookies = () => {
  const data = Cookies.get('simpleChatApp-userData')
  return data ? JSON.parse(data) : null
}
