import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCard } from "@/components/auth/AuthCard"
import { login } from "@/app/auth/actions"
import Link from "next/link"

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <AuthCard 
      title="Welcome back" 
      subtitle="Enter your credentials to access your account"
    >
      <form className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@example.com" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link 
              href="/forgot-password" 
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" required />
        </div>
        
        {searchParams.error && (
          <p className="text-sm font-medium text-destructive text-center">
            {searchParams.error}
          </p>
        )}

        <Button formAction={login} type="submit" className="w-full h-10 rounded-xl" size="lg">
          Sign In
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
