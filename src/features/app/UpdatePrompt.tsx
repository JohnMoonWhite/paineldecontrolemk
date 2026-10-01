import { useRegisterSW } from 'virtual:pwa-register/react'
import { UpdateBanner } from './UpdateBanner'

const checkEveryMs = 30 * 60000

/** Looks for a new published version and lets the user switch to it without reinstalling the app. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => { if (!document.hidden && navigator.onLine) void registration.update() }
      window.setInterval(check, checkEveryMs)
      document.addEventListener('visibilitychange', check)
    },
  })

  // updateServiceWorker(true) activates the waiting worker and reloads the page on the new version.
  return <UpdateBanner visible={needRefresh} onUpdate={() => void updateServiceWorker(true)} onDismiss={() => setNeedRefresh(false)} />
}
