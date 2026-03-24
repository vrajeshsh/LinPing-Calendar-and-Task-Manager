import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCard } from "@/components/auth/AuthCard"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  async function updatePassword(formData: FormData) {
    'use server'
    const password = formData.get("password") as string
    const supabase = await createClient()
    
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      return redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
    }

    return redirect("/login?message=Password updated successfully")
  }

  return (
    <AuthCard 
      title="New password" 
      subtitle="Enter your new secure password"
    >
      <form className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        
        {searchParams.error && (
          <p className="text-sm font-medium text-destructive text-center">
            {searchParams.error}
          </p>
        )}

        <Button formAction={updatePassword} type="submit" className="w-full h-10 rounded-xl" size="lg">
          Update Password
        </Button>
      </form>
    </AuthCard>
  )
}
