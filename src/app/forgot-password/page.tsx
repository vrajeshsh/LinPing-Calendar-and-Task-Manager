import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCard } from "@/components/auth/AuthCard"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>
}) {
  const params = await searchParams
  async function resetPassword(formData: FormData) {
    'use server'
    const email = formData.get("email") as string
    const supabase = await createClient()
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
    })

    if (error) {
      return redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`)
    }

    return redirect("/forgot-password?message=Check your email for the reset link")
  }

  return (
    <AuthCard 
      title="Reset password" 
      subtitle="We'll send a recovery link to your email"
    >
      <form className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@example.com" required />
        </div>
        
        {params.error && (
          <p className="text-sm font-medium text-destructive text-center">
            {params.error}
          </p>
        )}
        
        {params.message && (
          <p className="text-sm font-medium text-emerald-500 text-center">
            {params.message}
          </p>
        )}

        <Button formAction={resetPassword} type="submit" className="w-full h-10 rounded-xl" size="lg">
          Send Reset Link
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
