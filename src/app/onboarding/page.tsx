import { Button } from "@/components/ui/button"
import { AuthCard } from "@/components/auth/AuthCard"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  // Check if already onboarded
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.id)
    .single()

  if (profile?.onboarded) {
    return redirect("/")
  }

  return <OnboardingFlow />
}
