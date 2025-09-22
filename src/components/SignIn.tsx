import { LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

export function SignIn() {
  const { signInWithGoogle, enabled } = useAuth()

  if (!enabled) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">Planner</h1>
        <p className="text-sm text-muted-foreground">Authentication is disabled (no Firebase env). Continue without signing in.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your Google account to continue</p>
      </div>
      <Button className="gap-2" onClick={signInWithGoogle} aria-label="Continue with Google">
        <LogIn className="h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  )
}


