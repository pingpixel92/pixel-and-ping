import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/** Entry route: send to the panel when a session cookie exists, otherwise to login. */
export default async function Home() {
  const cookieStore = await cookies()
  const hasSession = cookieStore.has('pp_session')
  redirect(hasSession ? '/dashboard' : '/login')
}
