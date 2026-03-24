import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCard } from "@/components/auth/AuthCard"
import { signup } from "@/app/auth/actions"
import Link from "next/link"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <AuthCard 
      title="Create an account" 
      subtitle="Start your journey with LinPing AI Calendar"
    >
      <form className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        
        {params.error && (
          <p className="text-sm font-medium text-destructive text-center">
            {params.error}
          </p>
        )}

        <Button formAction={signup} type="submit" className="w-full h-10 rounded-xl" size="lg">
          Create Account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
