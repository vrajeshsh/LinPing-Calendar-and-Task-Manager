'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: signupData, error } = await supabase.auth.signUp(data)

  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  // Check if user was created and email confirmation is required
  if (signupData.user && !signupData.user.email_confirmed_at) {
    // Try to sign in immediately (works if email confirmation is disabled)
    const { error: signInError } = await supabase.auth.signInWithPassword(data)

    if (!signInError) {
      // Auto-signin worked, redirect to onboarding
      revalidatePath('/', 'layout')
      redirect('/onboarding')
    } else {
      // Email confirmation required, redirect to login with message
      return redirect(`/login?message=${encodeURIComponent('Account created successfully! Please check your email to confirm your account, then sign in.')}`)
    }
  }

  // User was created and confirmed immediately
  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
