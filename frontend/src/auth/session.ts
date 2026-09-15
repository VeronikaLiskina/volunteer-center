const key = "lapka-token";
export const sessionEvent = "lapka-session-change";
export const getToken = () => sessionStorage.getItem(key);
export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(key, token);
  else sessionStorage.removeItem(key);
  window.dispatchEvent(new Event(sessionEvent));
}
